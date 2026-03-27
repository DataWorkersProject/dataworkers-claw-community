# Data Context & Catalog Agent — Skill Reference

## What This Agent Does

The catalog agent is the knowledge hub of the Data Workers swarm. It crawls, indexes, and serves metadata about every data asset across an organization's stack — tables, views, models, pipelines, dashboards, and metrics. It provides natural-language search, column-level lineage, quality scoring, and automated documentation.

## When to Use Each Tool

| Tool | Use When |
|------|----------|
| `search_across_platforms` | Finding datasets by topic, keyword, or domain. Preferred over `search_datasets` (deprecated). |
| `trace_cross_platform_lineage` | Tracing where data comes from or what depends on it. Preferred over `get_lineage` (deprecated). |
| `blast_radius_analysis` | Assessing what breaks before making schema changes. Preferred over `assess_impact` (deprecated). |
| `resolve_metric` | Disambiguating metric names that may have multiple definitions across teams. |
| `list_semantic_definitions` | Browsing the semantic layer (metrics, dimensions, entities) from dbt, Looker, or Cube. |
| `check_freshness` | Verifying data is up-to-date relative to SLA targets. |
| `generate_documentation` | Creating or retrieving comprehensive auto-generated docs with provenance. Preferred over `get_documentation` (deprecated). |
| `get_context` | Getting a quick contextual summary for an asset (metadata, quality, freshness in one call). |

## Best Practices for Data Discovery

1. **Start broad, narrow down.** Use `search_across_platforms` with natural language, then filter by platform, type, or domain.
2. **Check quality before trusting.** Always look at `qualityScore` and `freshnessScore` before recommending a dataset.
3. **Follow the lineage.** After finding a table, trace its lineage to understand data provenance and find authoritative sources.
4. **Use the semantic layer.** When a user asks for a "metric," use `resolve_metric` first — there may be multiple definitions of "revenue."
5. **Assess before changing.** Before any schema modification, run `blast_radius_analysis` to identify downstream breakage.

## Common Query Patterns

### "Find me customer data"
1. `search_across_platforms({ "query": "customer" })`
2. Review results, pick the best match
3. `get_context({ "assetId": "<best_match_id>" })` for full details
4. `trace_cross_platform_lineage({ "assetId": "<id>" })` if lineage is needed

### "What is the definition of revenue?"
1. `resolve_metric({ "name": "revenue" })` to find all definitions
2. `list_semantic_definitions({ "domain": "finance" })` for related metrics
3. Compare definitions across teams to find the canonical one

### "Is this table safe to modify?"
1. `blast_radius_analysis({ "assetId": "<table>", "changeType": "schema-change" })`
2. Review affected downstream assets and their owners
3. `check_freshness({ "assetId": "<table>" })` to check SLA obligations

### "Generate docs for this table"
1. `generate_documentation({ "assetId": "<table>" })`
2. Review provenance to see which sources contributed to the documentation
3. Share with the asset owner for review

## Toolset Configuration

Tools are grouped into toolsets that can be enabled/disabled:

- `catalog_search` (enabled) — search and context tools
- `catalog_lineage` (enabled) — lineage and impact analysis
- `catalog_metadata` (enabled) — metrics, semantics, freshness, docs
- `catalog_analysis` (enabled) — reserved for future analytical tools
- `catalog_write` (disabled) — write operations (disabled by default for safety)
- `catalog_legacy` (disabled) — legacy tools kept for backward compatibility
