/**
 * query_data_nl — NL to SQL, execute, return results.
 *
 * Translates a natural language question into SQL, executes it against
 * the in-memory relational store, and returns structured results.
 *
 * Features:
 * - Pattern matching for common queries (revenue, users, churn)
 * - LLM fallback for unrecognized patterns (DAT-685)
 * - SQL safety: blocks write operations (DELETE/DROP/INSERT/UPDATE/ALTER)
 * - SQL injection sanitization for follow-ups (DAT-673)
 * - Cost guard: flags queries touching >10K rows as expensive
 * - Results capped at 10,000 rows
 * - Conversational follow-ups via session context with mutex (DAT-682)
 * - Computed confidence from signal count & stats (DAT-680)
 * - Query timeout and cost estimation (DAT-693)
 */

import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { QueryResult } from '../types.js';
import { relationalStore, kvStore, llmClient } from '../backends.js';
import { SemanticResolver } from '../engine/semantic-resolver.js';
import { sanitizeFollowUpSQL, validateSQL } from '../engine/sql-validator.js';
import { generateSQLWithLLM } from '../engine/llm-sql-generator.js';
import { computeConfidence } from '../engine/statistical-engine.js';

const resolver = new SemanticResolver();

/* ------------------------------------------------------------------ */
/*  Known schema introspection (DAT-972)                               */
/* ------------------------------------------------------------------ */

/** Known table schemas — populated from the relational store at init. */
const KNOWN_SCHEMA: Record<string, string[]> = {
  revenue_daily: ['date', 'amount', 'product_category', 'region'],
  user_metrics: ['date', 'active_users', 'new_signups', 'churn_count'],
};

/** Column aliases: maps natural language terms to actual column names. */
const COLUMN_ALIASES: Record<string, { column: string; table: string }> = {
  revenue: { column: 'amount', table: 'revenue_daily' },
  amount: { column: 'amount', table: 'revenue_daily' },
  sales: { column: 'amount', table: 'revenue_daily' },
  category: { column: 'product_category', table: 'revenue_daily' },
  categories: { column: 'product_category', table: 'revenue_daily' },
  region: { column: 'region', table: 'revenue_daily' },
  regions: { column: 'region', table: 'revenue_daily' },
  users: { column: 'active_users', table: 'user_metrics' },
  active_users: { column: 'active_users', table: 'user_metrics' },
  signups: { column: 'new_signups', table: 'user_metrics' },
  new_signups: { column: 'new_signups', table: 'user_metrics' },
  churn: { column: 'churn_count', table: 'user_metrics' },
  churn_count: { column: 'churn_count', table: 'user_metrics' },
  customers: { column: 'active_users', table: 'user_metrics' },
};

/**
 * Resolve a natural language term to a column and table.
 * Checks column aliases first, then exact column names across known tables.
 */
function resolveColumn(term: string): { column: string; table: string } | null {
  const lower = term.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (COLUMN_ALIASES[lower]) return COLUMN_ALIASES[lower];

  // Check exact column match across known tables
  for (const [table, columns] of Object.entries(KNOWN_SCHEMA)) {
    if (columns.includes(lower)) {
      return { column: lower, table };
    }
  }
  return null;
}

/**
 * Find the best matching table from the question text.
 * Uses the SemanticResolver aliases and direct table name matches.
 */
function findBestTable(question: string): string | null {
  const lower = question.toLowerCase();
  const knownTables = Object.keys(KNOWN_SCHEMA);

  // Direct table name match
  for (const table of knownTables) {
    if (lower.includes(table)) return table;
  }

  // Semantic alias match
  const words = lower.split(/\s+/);
  for (const word of words) {
    const resolved = resolver.resolve(word);
    if (resolved) return resolved;
  }

  // Column-based inference: if a column reference implies a table, use that
  for (const word of words) {
    const colInfo = resolveColumn(word);
    if (colInfo) return colInfo.table;
  }

  return null;
}

const MAX_ROWS = 10_000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const QUERY_TIMEOUT_MS = 30_000; // 30 seconds (DAT-693)

/** Unsafe SQL patterns (write operations). */
const UNSAFE_SQL_PATTERNS = /\b(DELETE|DROP|INSERT|UPDATE|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b/i;

/* ------------------------------------------------------------------ */
/*  Session Mutex (DAT-682)                                            */
/* ------------------------------------------------------------------ */

const sessionLocks = new Map<string, Promise<void>>();

/**
 * Serialize session updates so concurrent requests on the same session
 * don't race on read-modify-write of session context.
 */
async function withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  // Wait for any prior lock on this session to resolve
  const prev = sessionLocks.get(sessionId) ?? Promise.resolve();
  let releaseLock!: () => void;
  const lockPromise = new Promise<void>((resolve) => { releaseLock = resolve; });
  sessionLocks.set(sessionId, lockPromise);

  try {
    await prev;
    return await fn();
  } finally {
    releaseLock();
    // Clean up if we're still the latest lock
    if (sessionLocks.get(sessionId) === lockPromise) {
      sessionLocks.delete(sessionId);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  NL → SQL pattern matching                                          */
/* ------------------------------------------------------------------ */

/** Pattern-match common NL questions to SQL. Returns null if no match. */
function nlToSQL(question: string, previousSQL?: string): { sql: string; table: string; confidence: number; patternMatched: boolean } | null {
  const lower = question.toLowerCase().trim();

  // ── Follow-up modifications on previous SQL ───────────────────────
  if (previousSQL) {
    // DAT-673: Sanitize previous SQL to prevent injection
    const safePreviousSQL = sanitizeFollowUpSQL(previousSQL);
    if (!safePreviousSQL) {
      // Sanitization removed all SQL — treat as new query
      return null;
    }

    // "filter by X" or "where X"
    const filterMatch = lower.match(/(?:filter|where|only)\s+(?:by\s+)?(\w+)\s*[=:]\s*['"]?([^'"]+)['"]?/i);
    if (filterMatch) {
      const [, column, rawValue] = filterMatch;
      // DAT-673: Sanitize column and value to prevent injection
      const safeColumn = column.replace(/[^a-zA-Z0-9_]/g, '');
      const safeValue = rawValue.trim().replace(/'/g, "''");
      const table = safePreviousSQL.includes('revenue_daily') ? 'revenue_daily' : 'user_metrics';
      const baseSQL = safePreviousSQL.replace(/\s+ORDER BY[^;]*/i, '').replace(/\s+LIMIT\s+\d+/i, '');
      const hasWhere = baseSQL.toLowerCase().includes('where');
      const clause = hasWhere ? `AND ${safeColumn} = '${safeValue}'` : `WHERE ${safeColumn} = '${safeValue}'`;
      return { sql: `${baseSQL} ${clause}`, table, confidence: 0.75, patternMatched: true };
    }

    // "show only category X" or "for category X"
    const showOnlyMatch = lower.match(/(?:show only|for)\s+(?:category\s+)?['"]?(\w+)['"]?/i);
    if (showOnlyMatch) {
      const [, rawValue] = showOnlyMatch;
      const safeValue = rawValue.replace(/'/g, "''");
      const table = safePreviousSQL.includes('revenue_daily') ? 'revenue_daily' : 'user_metrics';
      const baseSQL = safePreviousSQL.replace(/\s+ORDER BY[^;]*/i, '').replace(/\s+LIMIT\s+\d+/i, '');
      const hasWhere = baseSQL.toLowerCase().includes('where');
      const clause = hasWhere ? `AND product_category = '${safeValue}'` : `WHERE product_category = '${safeValue}'`;
      return { sql: `${baseSQL} ${clause}`, table, confidence: 0.7, patternMatched: true };
    }
  }

  // ── Revenue queries ───────────────────────────────────────────────
  if (lower.includes('total revenue')) {
    return { sql: 'SELECT SUM(amount) FROM revenue_daily', table: 'revenue_daily', confidence: 0.95, patternMatched: true };
  }

  if (lower.includes('revenue by category') || lower.includes('revenue per category')) {
    return { sql: 'SELECT product_category, SUM(amount) FROM revenue_daily GROUP BY 1', table: 'revenue_daily', confidence: 0.92, patternMatched: true };
  }

  if (lower.includes('revenue by region') || lower.includes('revenue per region')) {
    return { sql: 'SELECT region, SUM(amount) FROM revenue_daily GROUP BY 1', table: 'revenue_daily', confidence: 0.92, patternMatched: true };
  }

  if (lower.includes('daily revenue') || lower.includes('revenue trend') || lower.includes('revenue over time')) {
    return { sql: 'SELECT date, SUM(amount) as daily_total FROM revenue_daily GROUP BY date ORDER BY date', table: 'revenue_daily', confidence: 0.9, patternMatched: true };
  }

  // ── User metrics queries ──────────────────────────────────────────
  if (lower.includes('active users trend') || lower.includes('active users over time')) {
    return { sql: 'SELECT date, active_users FROM user_metrics ORDER BY date', table: 'user_metrics', confidence: 0.93, patternMatched: true };
  }

  if (lower.includes('churn rate') || lower.includes('churn trend')) {
    return { sql: 'SELECT date, churn_count, active_users, ROUND(churn_count*100.0/active_users, 2) as churn_rate FROM user_metrics', table: 'user_metrics', confidence: 0.9, patternMatched: true };
  }

  if (lower.includes('new signups') || lower.includes('signup trend')) {
    return { sql: 'SELECT date, new_signups FROM user_metrics ORDER BY date', table: 'user_metrics', confidence: 0.91, patternMatched: true };
  }

  if (lower.includes('total active users') || lower.includes('average active users')) {
    return { sql: 'SELECT AVG(active_users) as avg_active_users FROM user_metrics', table: 'user_metrics', confidence: 0.88, patternMatched: true };
  }

  // ── DAT-972: Generic rule-based NL-to-SQL patterns ────────────────

  // "top N X by Y" → SELECT * FROM table ORDER BY Y DESC LIMIT N
  const topNMatch = lower.match(/top\s+(\d+)\s+(\w+)\s+by\s+(\w+)/);
  if (topNMatch) {
    const [, limitStr, subject, orderCol] = topNMatch;
    const limit = parseInt(limitStr, 10);
    const subjectInfo = resolveColumn(subject) || resolveColumn(orderCol);
    const orderInfo = resolveColumn(orderCol);
    const table = subjectInfo?.table || orderInfo?.table || findBestTable(question) || 'revenue_daily';
    const orderColumn = orderInfo?.column || orderCol;
    return { sql: `SELECT * FROM ${table} ORDER BY ${orderColumn} DESC LIMIT ${limit}`, table, confidence: 0.8, patternMatched: true };
  }

  // "count of X" or "how many X" → SELECT COUNT(*) FROM table
  const countMatch = lower.match(/(?:count\s+of|how\s+many)\s+(\w+)/);
  if (countMatch) {
    const [, subject] = countMatch;
    const subjectInfo = resolveColumn(subject);
    const table = subjectInfo?.table || findBestTable(question) || (resolver.resolve(subject) ?? 'user_metrics');
    return { sql: `SELECT COUNT(*) as count FROM ${table}`, table, confidence: 0.85, patternMatched: true };
  }

  // "average X" or "avg X" or "mean X" → SELECT AVG(X) FROM table
  const avgMatch = lower.match(/(?:average|avg|mean)\s+(\w+)/);
  if (avgMatch) {
    const [, subject] = avgMatch;
    const colInfo = resolveColumn(subject);
    if (colInfo) {
      return { sql: `SELECT AVG(${colInfo.column}) as avg_${colInfo.column} FROM ${colInfo.table}`, table: colInfo.table, confidence: 0.85, patternMatched: true };
    }
    // If we can't resolve the column, try table-level match
    const table = findBestTable(question) || 'revenue_daily';
    return { sql: `SELECT AVG(${subject}) as avg_${subject} FROM ${table}`, table, confidence: 0.7, patternMatched: true };
  }

  // "sum of X" or "total X" (generic, beyond the specific ones above) → SELECT SUM(X) FROM table
  const sumMatch = lower.match(/(?:sum\s+of|total)\s+(\w+)/);
  if (sumMatch) {
    const [, subject] = sumMatch;
    const colInfo = resolveColumn(subject);
    if (colInfo) {
      return { sql: `SELECT SUM(${colInfo.column}) as total_${colInfo.column} FROM ${colInfo.table}`, table: colInfo.table, confidence: 0.85, patternMatched: true };
    }
  }

  // "X where Y = Z" or "show X where Y" → SELECT * FROM X WHERE Y
  const whereMatch = lower.match(/(?:show|get|find|list)?\s*(\w+)\s+where\s+(\w+)\s*[=:]\s*['"]?([^'"]+)['"]?/);
  if (whereMatch) {
    const [, subject, column, rawValue] = whereMatch;
    const subjectInfo = resolveColumn(subject);
    const table = subjectInfo?.table || findBestTable(subject) || findBestTable(question) || 'revenue_daily';
    const safeColumn = column.replace(/[^a-zA-Z0-9_]/g, '');
    const safeValue = rawValue.trim().replace(/'/g, "''");
    return { sql: `SELECT * FROM ${table} WHERE ${safeColumn} = '${safeValue}'`, table, confidence: 0.8, patternMatched: true };
  }

  // "X by Y" (group by pattern) → SELECT Y, COUNT(*)/SUM(*) FROM table GROUP BY Y
  const groupByMatch = lower.match(/(\w+)\s+by\s+(\w+)/);
  if (groupByMatch) {
    const [, subject, groupCol] = groupByMatch;
    const subjectInfo = resolveColumn(subject);
    const groupInfo = resolveColumn(groupCol);
    if (subjectInfo || groupInfo) {
      const table = subjectInfo?.table || groupInfo?.table || 'revenue_daily';
      const aggCol = subjectInfo?.column || subject;
      const grpCol = groupInfo?.column || groupCol;
      // Use SUM for numeric columns (amount, active_users, etc.), COUNT otherwise
      const numericCols = ['amount', 'active_users', 'new_signups', 'churn_count'];
      const agg = numericCols.includes(aggCol) ? `SUM(${aggCol})` : `COUNT(*)`;
      return { sql: `SELECT ${grpCol}, ${agg} FROM ${table} GROUP BY 1`, table, confidence: 0.75, patternMatched: true };
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Result verification (DS-STAR)                                      */
/* ------------------------------------------------------------------ */

function verifyResults(sql: string, results: Record<string, unknown>[], _question: string): { verified: boolean; warning?: string } {
  if (results.length === 0 && !sql.toLowerCase().includes('count') && !sql.toLowerCase().includes('sum')) {
    return { verified: false, warning: 'Query returned no results. Consider broadening the time range or checking filters.' };
  }
  for (const row of results.slice(0, 5)) {
    for (const [key, val] of Object.entries(row)) {
      if (typeof val === 'number' && val > 1_000_000_000 && !key.includes('offset') && !key.includes('timestamp')) {
        return { verified: false, warning: `Unusually large value in ${key}: ${val}. Verify the query aggregation is correct.` };
      }
    }
  }
  return { verified: true };
}

/* ------------------------------------------------------------------ */
/*  Query execution                                                    */
/* ------------------------------------------------------------------ */

/**
 * Execute a SQL-like query against the in-memory relational store.
 * Includes timeout protection (DAT-693).
 */
async function executeQuery(sql: string, table: string, timeoutMs: number = QUERY_TIMEOUT_MS): Promise<{ results: Record<string, unknown>[]; rowCount: number }> {
  // DAT-693: Wrap execution in a timeout
  const result = await Promise.race([
    executeQueryInner(sql, table),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Query timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
  return result;
}

async function executeQueryInner(sql: string, table: string): Promise<{ results: Record<string, unknown>[]; rowCount: number }> {
  const lowerSQL = sql.toLowerCase();

  // Determine filter from WHERE clauses
  let filter: ((row: Record<string, unknown>) => boolean) | undefined;
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+GROUP|\s+ORDER|\s+LIMIT|$)/i);
  if (whereMatch) {
    const conditions = whereMatch[1].split(/\s+AND\s+/i);
    filter = (row) => {
      return conditions.every((cond) => {
        const m = cond.match(/(\w+)\s*=\s*'?([^']+)'?/);
        if (!m) return true;
        return String(row[m[1]]).toLowerCase() === m[2].trim().toLowerCase();
      });
    };
  }

  const rows = await relationalStore.query(table, filter);

  // Handle aggregations
  if (lowerSQL.includes('sum(amount)') && lowerSQL.includes('group by')) {
    const groupCol = lowerSQL.includes('product_category') ? 'product_category'
      : lowerSQL.includes('region') ? 'region'
      : lowerSQL.includes('date') ? 'date'
      : 'date';

    const groups = new Map<string, number>();
    for (const row of rows) {
      const key = String(row[groupCol]);
      groups.set(key, (groups.get(key) || 0) + (row.amount as number));
    }

    const results: Record<string, unknown>[] = [];
    for (const [key, total] of groups) {
      results.push({ [groupCol]: key, total_amount: Math.round(total * 100) / 100 });
    }
    return { results, rowCount: results.length };
  }

  if (lowerSQL.includes('sum(amount)') && !lowerSQL.includes('group by')) {
    const total = rows.reduce((sum, row) => sum + (row.amount as number), 0);
    return { results: [{ total_revenue: Math.round(total * 100) / 100 }], rowCount: 1 };
  }

  if (lowerSQL.includes('avg(active_users)')) {
    const avg = rows.reduce((sum, row) => sum + (row.active_users as number), 0) / (rows.length || 1);
    return { results: [{ avg_active_users: Math.round(avg) }], rowCount: 1 };
  }

  // DAT-972: Generic AVG(column) support
  const genericAvgMatch = lowerSQL.match(/avg\((\w+)\)/);
  if (genericAvgMatch && !lowerSQL.includes('avg(active_users)')) {
    const col = genericAvgMatch[1];
    const avg = rows.reduce((sum, row) => sum + (Number(row[col]) || 0), 0) / (rows.length || 1);
    return { results: [{ [`avg_${col}`]: Math.round(avg * 100) / 100 }], rowCount: 1 };
  }

  // DAT-972: Generic COUNT(*) support
  if (lowerSQL.includes('count(*)') && !lowerSQL.includes('group by')) {
    return { results: [{ count: rows.length }], rowCount: 1 };
  }

  // DAT-972: Generic SUM(column) support (beyond amount)
  const genericSumMatch = lowerSQL.match(/sum\((\w+)\)/);
  if (genericSumMatch && !lowerSQL.includes('sum(amount)')) {
    const col = genericSumMatch[1];
    if (lowerSQL.includes('group by')) {
      // Grouped SUM
      const groupColMatch = lowerSQL.match(/select\s+(\w+)/);
      const groupCol = groupColMatch ? groupColMatch[1] : 'date';
      const groups = new Map<string, number>();
      for (const row of rows) {
        const key = String(row[groupCol]);
        groups.set(key, (groups.get(key) || 0) + (Number(row[col]) || 0));
      }
      const results: Record<string, unknown>[] = [];
      for (const [key, total] of groups) {
        results.push({ [groupCol]: key, [`total_${col}`]: Math.round(total * 100) / 100 });
      }
      return { results, rowCount: results.length };
    }
    const total = rows.reduce((sum, row) => sum + (Number(row[col]) || 0), 0);
    return { results: [{ [`total_${col}`]: Math.round(total * 100) / 100 }], rowCount: 1 };
  }

  // DAT-972: Generic COUNT(*) with GROUP BY
  if (lowerSQL.includes('count(*)') && lowerSQL.includes('group by')) {
    const groupColMatch = lowerSQL.match(/select\s+(\w+)/);
    const groupCol = groupColMatch ? groupColMatch[1] : 'date';
    const groups = new Map<string, number>();
    for (const row of rows) {
      const key = String(row[groupCol]);
      groups.set(key, (groups.get(key) || 0) + 1);
    }
    const results: Record<string, unknown>[] = [];
    for (const [key, count] of groups) {
      results.push({ [groupCol]: key, count });
    }
    return { results, rowCount: results.length };
  }

  if (lowerSQL.includes('churn_count') && lowerSQL.includes('churn_rate')) {
    const results = rows.map((row) => ({
      date: row.date,
      churn_count: row.churn_count,
      active_users: row.active_users,
      churn_rate: Math.round(((row.churn_count as number) * 100.0 / (row.active_users as number)) * 100) / 100,
    }));
    return { results, rowCount: results.length };
  }

  // Determine ordering
  let orderBy: { column: string; direction: 'asc' | 'desc' } | undefined;
  const orderMatch = sql.match(/ORDER BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
  if (orderMatch) {
    orderBy = { column: orderMatch[1], direction: (orderMatch[2]?.toLowerCase() || 'asc') as 'asc' | 'desc' };
  }

  let results = await relationalStore.query(table, filter, orderBy);

  // Select only requested columns if specific columns are listed
  const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
  if (selectMatch && selectMatch[1] !== '*') {
    const cols = selectMatch[1].split(',').map((c) => c.trim().replace(/\s+as\s+\w+/i, '').trim());
    if (cols.length > 0 && !cols.some((c) => c.includes('('))) {
      results = results.map((row) => {
        const filtered: Record<string, unknown> = {};
        for (const col of cols) {
          if (row[col] !== undefined) {
            filtered[col] = row[col];
          }
        }
        return filtered;
      });
    }
  }

  // DAT-972: Apply LIMIT clause
  const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
  if (limitMatch) {
    const limit = parseInt(limitMatch[1], 10);
    results = results.slice(0, limit);
  }

  return { results, rowCount: results.length };
}

/* ------------------------------------------------------------------ */
/*  Cost estimation (DAT-693)                                          */
/* ------------------------------------------------------------------ */

function estimateCost(totalRowCount: number, sql: string): string | undefined {
  if (totalRowCount <= 10_000) return undefined;

  const hasGroupBy = /\bGROUP BY\b/i.test(sql);
  const hasJoin = /\bJOIN\b/i.test(sql);
  const multiplier = (hasGroupBy ? 1.5 : 1) * (hasJoin ? 2 : 1);
  const estimatedCostUnits = Math.round(totalRowCount * multiplier / 1000);

  return `Warning: query scans ${totalRowCount.toLocaleString()} rows (~${estimatedCostUnits} cost units) — consider adding filters to reduce cost.`;
}

/* ------------------------------------------------------------------ */
/*  Tool definition & handler                                          */
/* ------------------------------------------------------------------ */

export const queryDataNLDefinition: ToolDefinition = {
  name: 'query_data_nl',
  description:
    'Translate a natural language question into SQL, execute it, and return structured results. Supports conversational follow-ups via session context. Read-only queries only.',
  inputSchema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'Natural language question about the data.' },
      customerId: { type: 'string', description: 'Customer identifier.' },
      context: {
        type: 'object',
        description: 'Optional session context for conversational follow-ups.',
        properties: {
          previousSQL: { type: 'string', description: 'Previous SQL query for follow-up context.' },
          sessionId: { type: 'string', description: 'Session ID for conversational state.' },
        },
      },
    },
    required: ['question', 'customerId'],
  },
};

export const queryDataNLHandler: ToolHandler = async (args) => {
  const question = args.question as string;
  const customerId = args.customerId as string;
  const queryContext = args.context as { previousSQL?: string; sessionId?: string } | undefined;

  try {
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'question is required and must be a non-empty string' }) }],
        isError: true,
      };
    }

    if (!customerId || typeof customerId !== 'string') {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'customerId is required' }) }],
        isError: true,
      };
    }

    const sessionId = queryContext?.sessionId || `session-${Date.now()}`;

    // DAT-682: Use session mutex for all session-dependent operations
    return await withSessionLock(sessionId, async () => {
      const startTime = Date.now();

      // Retrieve previous SQL from session context if sessionId is provided
      let previousSQL = queryContext?.previousSQL;
      if (queryContext?.sessionId && !previousSQL) {
        const sessionData = await kvStore.get(`session:${queryContext.sessionId}`);
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          previousSQL = parsed.lastSQL;
        }
      }

      // DAT-673: Sanitize previous SQL if present
      if (previousSQL) {
        previousSQL = sanitizeFollowUpSQL(previousSQL);
      }

      // Try semantic resolution before pattern matching
      let semanticTable: string | null = null;
      const words = question.toLowerCase().split(/\s+/);
      for (const word of words) {
        const resolved = resolver.resolve(word);
        if (resolved) {
          semanticTable = resolved;
          break;
        }
      }

      // Pattern-match NL to SQL
      const matched = nlToSQL(question, previousSQL || undefined);
      let sql: string;
      let table: string;
      let patternMatched: boolean;
      let signalCount = 0;

      if (matched) {
        sql = matched.sql;
        table = matched.table;
        patternMatched = matched.patternMatched;
        signalCount = 2; // pattern + semantic match
      } else if (semanticTable) {
        sql = `SELECT * FROM ${semanticTable} LIMIT 10`;
        table = semanticTable;
        patternMatched = false;
        signalCount = 1;
      } else {
        // DAT-685: Use LLM SQL generator with structured prompts as enhanced fallback
        const llmResult = await generateSQLWithLLM(llmClient, question, previousSQL || undefined);
        if (llmResult && llmResult.validation.valid) {
          sql = llmResult.sql;
          table = llmResult.table;
          patternMatched = false;
          signalCount = 1;
        } else {
          // Final fallback: raw LLM call
          const llmResponse = await llmClient.complete(
            `Generate SQL for the following question against tables revenue_daily(date, amount, product_category, region) and user_metrics(date, active_users, new_signups, churn_count): ${question}`,
          );
          sql = llmResponse.content;
          table = sql.toLowerCase().includes('user_metrics') ? 'user_metrics' : 'revenue_daily';
          patternMatched = false;
          signalCount = 0;
        }
      }

      // SQL safety check: block write operations
      if (UNSAFE_SQL_PATTERNS.test(sql)) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Write operations are not allowed. Only read-only queries are supported.' }) }],
          isError: true,
        };
      }

      // DAT-684: Validate SQL
      const validation = validateSQL(sql);
      if (!validation.valid) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `Invalid SQL: ${validation.errors.join('; ')}` }) }],
          isError: true,
        };
      }

      // Execute with timeout (DAT-693)
      const { results: rawResults, rowCount: totalRowCount } = await executeQuery(sql, table);

      // Cap results at MAX_ROWS
      const truncated = totalRowCount > MAX_ROWS;
      const results = truncated ? rawResults.slice(0, MAX_ROWS) : rawResults;
      const rowCount = results.length;

      // DS-STAR: Iterative verification loop
      const verification = verifyResults(sql, results, question);

      // DAT-693: Cost estimation
      const costEstimate = estimateCost(totalRowCount, sql);

      const executionTimeMs = Date.now() - startTime;

      // DAT-680: Compute confidence from signals instead of hardcoded value
      const confidence = computeConfidence({
        signalCount,
        statisticalStrength: verification.verified ? 0.8 : 0.3,
        sampleSize: rowCount,
        patternMatched,
      });

      const queryResult: QueryResult = {
        sql,
        results,
        rowCount,
        truncated,
        executionTimeMs,
        costEstimate,
        confidence,
        ...(verification.warning ? { verification: { verified: verification.verified, warning: verification.warning } } : { verification: { verified: verification.verified } }),
      };

      // Store session context (inside the mutex)
      await kvStore.set(
        `session:${sessionId}`,
        JSON.stringify({ lastSQL: sql, lastTable: table, customerId, timestamp: Date.now() }),
        SESSION_TTL_MS,
      );

      // Cache the query result
      const cacheKey = `cache:${customerId}:${question.toLowerCase().trim()}`;
      await kvStore.set(cacheKey, JSON.stringify(queryResult), SESSION_TTL_MS);

      return { content: [{ type: 'text', text: JSON.stringify(queryResult, null, 2) }] };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
      isError: true,
    };
  }
};
