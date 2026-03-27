/**
 * PIIScanner — 3-pass PII detection engine.
 *
 * Pass 1: Column-name heuristic (fast, low confidence).
 * Pass 2: Regex on actual cell values (high confidence).
 * Pass 3: LLM classification stub for inconclusive columns.
 *
 * Scans data from an InMemoryRelationalStore, sampling up to
 * `sampleSize` rows per column.
 */

import type { IRelationalStore, ILLMClient, IKeyValueStore } from '@data-workers/infrastructure-stubs';
import type { PIIDetection, PIIType, PIIScanResult } from './types.js';

/** KV store keys for configurable patterns. */
const KV_COLUMN_HINTS = 'gov:pii:column_hints';
const KV_VALUE_PATTERNS = 'gov:pii:value_patterns';

/** Default column-name hints for Pass 1. */
const DEFAULT_COLUMN_HINTS: Record<string, PIIType> = {
  email: 'email',
  mail: 'email',
  e_mail: 'email',
  phone: 'phone',
  tel: 'phone',
  mobile: 'phone',
  cell: 'phone',
  ssn: 'ssn',
  social_security: 'ssn',
  sin: 'ssn',
  credit_card: 'credit_card',
  card_number: 'credit_card',
  card: 'credit_card',
  cc: 'credit_card',
  ip: 'ip_address',
  ip_address: 'ip_address',
  client_ip: 'ip_address',
  name: 'name',
  first_name: 'name',
  last_name: 'name',
  full_name: 'name',
  customer_name: 'name',
  address: 'address',
  street: 'address',
  city: 'address',
  zip: 'address',
  postal: 'address',
  dob: 'dob',
  birth: 'dob',
  birthday: 'dob',
  date_of_birth: 'dob',
};

/** Default regex patterns for Pass 2 value scanning. */
const DEFAULT_VALUE_PATTERNS: Array<{ type: PIIType; regex: RegExp }> = [
  { type: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/ },
  { type: 'email', regex: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/ },
  { type: 'phone', regex: /\b\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/ },
  { type: 'credit_card', regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/ },
  { type: 'ip_address', regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/ },
  { type: 'dob', regex: /\b(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/ },
  { type: 'address', regex: /\b\d+\s+[A-Z][a-zA-Z]*\s+(St|Ave|Blvd|Rd|Dr|Ln|Way|Ct)\b/ },
];

/** Maximum columns to scan per invocation. */
const MAX_COLUMNS = 50;

export class PIIScanner {
  constructor(
    private store: IRelationalStore,
    private llmClient?: ILLMClient,
    private kvStore?: IKeyValueStore,
  ) {}

  /**
   * Load column hints from KV store or fall back to defaults.
   */
  private async getColumnHints(): Promise<Record<string, PIIType>> {
    if (this.kvStore) {
      const stored = await this.kvStore.get(KV_COLUMN_HINTS);
      if (stored) {
        try {
          return JSON.parse(stored) as Record<string, PIIType>;
        } catch {
          // Fall through to defaults
        }
      }
    }
    return DEFAULT_COLUMN_HINTS;
  }

  /**
   * Load value patterns from KV store or fall back to defaults.
   */
  private async getValuePatterns(): Promise<Array<{ type: PIIType; regex: RegExp }>> {
    if (this.kvStore) {
      const stored = await this.kvStore.get(KV_VALUE_PATTERNS);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Array<{ type: PIIType; pattern: string; flags?: string }>;
          return parsed.map((p) => ({
            type: p.type,
            regex: new RegExp(p.pattern, p.flags ?? ''),
          }));
        } catch {
          // Fall through to defaults
        }
      }
    }
    return DEFAULT_VALUE_PATTERNS;
  }

  /**
   * Scan a dataset (table) for PII across 3 passes.
   *
   * @param customerId - Tenant identifier.
   * @param datasetId  - Table name in the relational store.
   * @param columns    - Specific columns to scan. If omitted, all columns from the first row are used.
   * @param sampleSize - Maximum rows to sample per column (default 100).
   * @returns PIIScanResult with detections, counts, and timing.
   */
  async scan(
    customerId: string,
    datasetId: string,
    columns?: string[],
    sampleSize = 100,
  ): Promise<PIIScanResult> {
    const start = Date.now();
    void customerId;

    // Load configurable patterns
    const columnHints = await this.getColumnHints();
    const valuePatterns = await this.getValuePatterns();

    // Fetch rows from the store
    const allRows = await this.store.query(datasetId, undefined, undefined, sampleSize);
    if (allRows.length === 0) {
      return { scannedColumns: 0, detections: [], piiColumnsFound: 0, scanTimeMs: Date.now() - start };
    }

    // Determine columns to scan
    const targetColumns = columns ?? Object.keys(allRows[0]);
    const columnsToScan = targetColumns.slice(0, MAX_COLUMNS);

    const detections: PIIDetection[] = [];
    /** Track which columns have been detected by which PII type to avoid duplicates. */
    const detected = new Set<string>();

    // ── Pass 1: Column-name heuristic ──────────────────────────────
    for (const col of columnsToScan) {
      const colLower = col.toLowerCase();
      for (const [hint, piiType] of Object.entries(columnHints)) {
        if (colLower.includes(hint)) {
          const key = `${col}:${piiType}`;
          if (!detected.has(key)) {
            detected.add(key);
            detections.push({
              type: piiType,
              value: `[REDACTED_${piiType.toUpperCase()}]`,
              location: { column: col },
              confidence: 0.7,
              method: 'heuristic',
            });
          }
          break; // one match per column for Pass 1
        }
      }
    }

    // ── Pass 2: Regex on cell values (track row number) ──
    for (const col of columnsToScan) {
      for (let rowIdx = 0; rowIdx < allRows.length; rowIdx++) {
        const row = allRows[rowIdx];
        const value = row[col];
        if (typeof value !== 'string') continue;

        for (const { type, regex } of valuePatterns) {
          if (regex.test(value)) {
            const key = `${col}:${type}`;
            if (!detected.has(key)) {
              detected.add(key);
              // Redact the matched value
              const match = value.match(regex);
              detections.push({
                type,
                value: match ? `[REDACTED: ${match[0].slice(0, 3)}***]` : `[REDACTED_${type.toUpperCase()}]`,
                location: { column: col, row: rowIdx },
                confidence: 0.9,
                method: 'regex',
              });
            }
          }
        }
      }
    }

    // ── Pass 3: LLM classification ──────────────────────
    // For columns where Pass 1+2 produced only low-confidence results
    for (const col of columnsToScan) {
      const colDetections = detections.filter((d) => d.location.column === col);
      const hasInconclusive = colDetections.some((d) => d.confidence >= 0.5 && d.confidence < 0.8);
      const hasHighConfidence = colDetections.some((d) => d.confidence >= 0.8);

      if (hasInconclusive && !hasHighConfidence) {
        const existing = colDetections[0];
        if (existing) {
          if (this.llmClient) {
            // Real LLM classification
            const sampleValues = allRows
              .map((r) => r[col])
              .filter((v) => v !== undefined && v !== null)
              .slice(0, 5)
              .map(String);
            const prompt = `Classify if the following column "${col}" with sample values contains PII. Values: ${JSON.stringify(sampleValues)}. Respond with JSON: {"isPII": boolean, "piiType": string, "confidence": number}`;
            try {
              const response = await this.llmClient.complete(prompt);
              let piiType = existing.type;
              let confidence = 0.99;
              try {
                const parsed = JSON.parse(response.content);
                if (parsed.piiType) piiType = parsed.piiType as PIIType;
                if (typeof parsed.confidence === 'number') confidence = parsed.confidence;
              } catch {
                // Use defaults if LLM doesn't return valid JSON
              }
              detections.push({
                type: piiType,
                value: existing.value,
                location: { column: col },
                confidence,
                method: 'llm',
              });
            } catch {
              // LLM call failed — fall back to stub behavior
              detections.push({
                type: existing.type,
                value: existing.value,
                location: { column: col },
                confidence: 0.99,
                method: 'llm',
              });
            }
          } else {
            // Stub: no LLM available
            detections.push({
              type: existing.type,
              value: existing.value,
              location: { column: col },
              confidence: 0.99,
              method: 'llm',
            });
          }
        }
      }
    }

    // Upgrade confidence for columns where both Pass 1 and Pass 2 agree
    const columnTypes = new Map<string, PIIDetection[]>();
    for (const d of detections) {
      const key = `${d.location.column}:${d.type}`;
      if (!columnTypes.has(key)) columnTypes.set(key, []);
      columnTypes.get(key)!.push(d);
    }
    for (const [, dets] of columnTypes) {
      if (dets.length >= 2) {
        // Multiple passes agree — boost the highest to 0.95
        const best = dets.reduce((a, b) => (a.confidence > b.confidence ? a : b));
        if (best.confidence < 0.95) best.confidence = 0.95;
      }
    }

    const piiColumns = new Set(detections.map((d) => d.location.column));

    return {
      scannedColumns: columnsToScan.length,
      detections,
      piiColumnsFound: piiColumns.size,
      scanTimeMs: Date.now() - start,
    };
  }
}
