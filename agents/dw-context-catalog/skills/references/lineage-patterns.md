# Cross-Platform Lineage Patterns Reference

The catalog agent traces data lineage across platform boundaries. This document describes common lineage patterns and how the agent resolves them.

## Lineage Relationship Types

| Relationship | Meaning |
|-------------|---------|
| `derives_from` | Asset is built from this upstream source |
| `consumed_by` | Asset feeds into this downstream consumer |
| `transforms` | Asset applies a transformation (e.g. dbt model, Spark job) |

## Common Cross-Platform Patterns

### 1. Ingestion → Warehouse → Transformation → BI

The most common enterprise pattern:

```
Fivetran (source) → Snowflake (raw) → dbt (staging/mart) → Looker (dashboard)
```

- **Lineage breaks at:** Ingestion-to-warehouse boundary (Fivetran → Snowflake)
- **Resolution:** Match Fivetran connector destinations to Snowflake table names
- **Column lineage:** Available from dbt onward; inferred for ingestion layer

### 2. Multi-Warehouse Federation

Data replicated across warehouses for different teams:

```
Snowflake (finance) ←→ BigQuery (analytics) ← dbt (shared models)
```

- **Lineage breaks at:** Cross-warehouse replication
- **Resolution:** Match on table name + schema patterns, validate via row-count reconciliation
- **Risk:** Staleness divergence between replicas

### 3. Streaming → Lake → Warehouse

Real-time data flowing through a lakehouse:

```
Kafka (events) → Flink (enrichment) → Iceberg (lake) → Snowflake (warehouse)
```

- **Lineage breaks at:** Flink job boundaries, Iceberg-to-Snowflake materialization
- **Resolution:** Flink job metadata links topics to tables; external table definitions bridge Iceberg to Snowflake
- **Column lineage:** Flink SQL preserves column mappings; Spark jobs require analysis

### 4. Reverse ETL / Operational Analytics

Data flowing back into operational systems:

```
Snowflake (mart) → Census/Hightouch (sync) → Salesforce (CRM)
```

- **Lineage breaks at:** Reverse ETL boundary
- **Resolution:** Sync configuration maps mart columns to CRM fields
- **Impact:** Changes to mart columns can break CRM workflows

### 5. ML Feature Stores

Features extracted from warehouse for model training:

```
BigQuery (source) → dbt (features) → Feast (feature store) → Model (training)
```

- **Lineage breaks at:** Feature store ingestion
- **Resolution:** Feast feature definitions reference source tables
- **Column lineage:** Feature-to-source column mapping stored in Feast metadata

## Lineage Depth Guidelines

| Depth | Use Case |
|-------|----------|
| 1 | Direct dependencies only — quick check |
| 2–3 | Standard analysis — covers most immediate impact |
| 5 | Full blast radius — recommended for schema changes |
| 10+ | Deep audit — compliance and data provenance investigations |

## Column-Level Lineage Resolution

Column lineage is the most valuable but hardest to resolve. The catalog agent uses these strategies:

1. **SQL parsing:** Extract column references from SQL transformations (dbt, views, stored procedures)
2. **Schema matching:** When SQL is unavailable, match columns by name + type across connected assets
3. **Metadata annotations:** Use platform-native column lineage (Snowflake ACCESS_HISTORY, BigQuery INFORMATION_SCHEMA)
4. **Pattern inference:** For ingestion layers, infer 1:1 column mapping when schemas are identical

## Best Practices

- Always specify depth > 1 when assessing change impact
- Use `direction: "both"` for full picture, `"downstream"` for blast radius
- Cross-platform lineage may have gaps — check `confidence` scores on lineage edges
- Column lineage from SQL parsing has highest confidence; pattern inference has lowest
- Re-crawl assets before critical lineage queries to ensure freshness
