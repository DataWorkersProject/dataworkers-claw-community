# Persona Benchmark Report

**Generated:** 2026-03-27T18:18:16.433Z
**Total scenarios evaluated:** 140
**Overall composite score:** 65.0%

## Results by Persona

| Persona | Scenarios | Avg Composite |
|---------|-----------|---------------|
| data_engineer | 28 | 69.5% |
| analytics_engineer | 18 | 66.8% |
| data_platform_lead | 13 | 56.0% |
| data_scientist | 17 | 58.1% |
| ml_engineer | 11 | 58.3% |
| openclaw_user | 17 | 70.3% |
| governance_officer | 18 | 64.9% |
| data_practitioner | 18 | 68.8% |

## Results by Seed Dataset

| Seed | Scenarios | Avg Composite |
|------|-----------|---------------|
| jaffle-shop | 105 | 63.1% |
| openmetadata | 35 | 70.8% |

## Results by Agent

| Agent | Scenarios | Avg Composite | Routing Hit Rate |
|-------|-----------|---------------|------------------|
| dw-context-catalog | 75 | 69.2% | 100% |
| dw-pipelines | 3 | 52.8% | 100% |
| dw-quality | 18 | 74.7% | 100% |
| dw-schema | 3 | 51.2% | 100% |
| dw-streaming | 1 | 38.9% | 0% |
| dw-incidents | 3 | 72.1% | 100% |
| dw-connectors | 1 | 58.4% | 100% |
| dw-cost | 6 | 48.0% | 0% |
| dw-governance | 15 | 59.5% | 100% |
| dw-usage-intelligence | 1 | 65.5% | 100% |
| dw-observability | 2 | 56.3% | 100% |
| dw-insights | 7 | 48.0% | 0% |
| dw-ml | 5 | 51.1% | 100% |

## Results by Difficulty

| Difficulty | Scenarios | Avg Composite | Weighted Composite |
|------------|-----------|---------------|--------------------|
| basic | 78 | 68.9% | 68.9% |
| intermediate | 48 | 60.1% | 75.1% |
| advanced | 14 | 60.7% | 91.1% |

## Latency Compliance

- **Scenarios with latency budget:** 117
- **Compliant (within budget):** 117
- **Compliance rate:** 100.0%

## Multi-Seed Consistency (Jaccard Token Similarity)

- **Hardcoded responses** (Jaccard > 0.95): 35
- **Seed-sensitive responses** (Jaccard <= 0.95): 0

| Scenario | Jaccard Similarity |
|----------|--------------------|
| de-search-customer-tables | 100.0% |
| de-search-revenue-data | 100.0% |
| de-trace-orders-lineage | 100.0% |
| de-check-freshness | 100.0% |
| de-run-quality-check | 100.0% |
| de-cross-platform-search | 100.0% |
| ae-explain-orders-table | 98.4% |
| ae-get-anomalies | 100.0% |
| ae-quality-score | 100.0% |
| dpl-scan-pii | 100.0% |
| ds-nl-query-top-customers | 100.0% |
| ds-search-ml-features | 100.0% |
| ds-get-context-orders | 100.0% |
| ds-search-events | 100.0% |
| ml-check-data-quality | 100.0% |
| ocu-search-tables | 100.0% |
| ocu-explain-table | 98.2% |
| ocu-view-lineage | 100.0% |
| ocu-check-freshness | 100.0% |
| ocu-get-context | 97.4% |
| ocu-quality-score | 100.0% |
| ocu-cross-platform-search | 100.0% |
| gov-scan-pii-customers | 100.0% |
| gov-lineage-audit | 100.0% |
| gov-quality-check-compliance | 100.0% |
| gov-search-sensitive-data | 100.0% |
| dp-discover-data | 100.0% |
| dp-understand-orders | 98.4% |
| dp-check-quality | 100.0% |
| dp-simple-lineage | 100.0% |
| dp-check-anomalies | 100.0% |
| dp-get-full-context | 100.0% |
| ms-new-member-onboarding | 98.7% |
| neg-search-nonexistent-table | 100.0% |
| neg-lineage-nonexistent-asset | 100.0% |

## Negative Test Results

- **Total negative tests:** 17
- **Graceful handling rate:** 94.1%

## Multi-Step Scenario Results

- **Total multi-step scenarios:** 7
- **Avg composite:** 67.9%
- **Handoff success rate:** 25.0%

## Coverage Map

### Agents Tested by Persona

| Agent | Personas |
|-------|----------|
| dw-context-catalog | analytics_engineer, data_engineer, data_platform_lead, data_practitioner, data_scientist, governance_officer, ml_engineer, openclaw_user |
| dw-pipelines | data_engineer, ml_engineer |
| dw-quality | analytics_engineer, data_engineer, data_practitioner, governance_officer, ml_engineer, openclaw_user |
| dw-schema | analytics_engineer, data_engineer, governance_officer |
| dw-streaming | data_engineer |
| dw-incidents | data_engineer |
| dw-connectors | analytics_engineer |
| dw-cost | data_platform_lead, data_scientist |
| dw-governance | data_platform_lead, governance_officer |
| dw-usage-intelligence | data_platform_lead |
| dw-observability | data_engineer, data_platform_lead, ml_engineer |
| dw-insights | data_practitioner, data_scientist |
| dw-ml | ml_engineer |

### Tools Tested by Persona

| Tool | Personas |
|------|----------|
| search_datasets | analytics_engineer, data_engineer, data_practitioner, data_scientist, governance_officer, ml_engineer, openclaw_user |
| get_lineage | data_engineer, data_practitioner, governance_officer, openclaw_user |
| check_freshness | analytics_engineer, data_engineer, data_practitioner, ml_engineer, openclaw_user |
| blast_radius_analysis | data_engineer, data_platform_lead, governance_officer |
| generate_pipeline | data_engineer, ml_engineer |
| run_quality_check | data_engineer, data_practitioner, governance_officer, ml_engineer |
| detect_schema_change | data_engineer, governance_officer |
| validate_pipeline | data_engineer |
| monitor_lag | data_engineer |
| search_across_platforms | data_engineer, openclaw_user |
| diagnose_incident | data_engineer |
| explain_table | analytics_engineer, data_practitioner, openclaw_user |
| set_sla | analytics_engineer |
| generate_documentation | analytics_engineer |
| get_anomalies | analytics_engineer, data_engineer, data_practitioner |
| validate_schema_compatibility | analytics_engineer, data_engineer, governance_officer |
| resolve_metric | analytics_engineer, openclaw_user |
| get_quality_score | analytics_engineer, data_practitioner, openclaw_user |
| define_business_rule | analytics_engineer |
| list_semantic_definitions | analytics_engineer, openclaw_user |
| get_dbt_model_lineage | analytics_engineer |
| check_staleness | analytics_engineer |
| import_tribal_knowledge | analytics_engineer |
| get_cost_dashboard | data_platform_lead |
| estimate_savings | data_platform_lead |
| find_unused_data | data_platform_lead |
| scan_pii | data_platform_lead, governance_officer |
| generate_audit_report | data_platform_lead, governance_officer |
| get_adoption_dashboard | data_platform_lead |
| check_agent_health | data_engineer, data_platform_lead |
| provision_access | data_platform_lead, governance_officer |
| check_policy | data_platform_lead, governance_officer |
| recommend_archival | data_platform_lead |
| query_data_nl | data_practitioner, data_scientist |
| generate_insight | data_scientist |
| explain_anomaly | data_scientist |
| get_context | data_practitioner, data_scientist, openclaw_user |
| export_insight | data_scientist |
| correlate_metadata | data_scientist |
| estimate_query_cost | data_scientist |
| identify_golden_path | data_scientist |
| analyze_query_history | data_scientist |
| suggest_features | ml_engineer |
| select_model | ml_engineer |
| train_model | ml_engineer |
| evaluate_model | ml_engineer |
| deploy_model | ml_engineer |
| detect_drift | ml_engineer |
| get_documentation | data_practitioner, openclaw_user |
| enforce_rbac | governance_officer |

## Detailed Scenario Results

| Scenario | Persona | Seed | Routing | Complete | Ground | Action | Specific | NegHdl | Structure | Latency | Composite | Ms |
|----------|---------|------|---------|----------|--------|--------|----------|--------|-----------|---------|-----------|-----|
| de-search-customer-tables | data_engineer | jaffle-shop | 100.0% | 66.7% | 11.4% | 50.0% | 36.4% | 100.0% | 100.0% | 100.0% | 69.4% | 11ms |
| de-search-revenue-data | data_engineer | jaffle-shop | 100.0% | 50.0% | 13.6% | 50.0% | 2.7% | 100.0% | 100.0% | 100.0% | 63.1% | 1ms |
| de-trace-orders-lineage | data_engineer | jaffle-shop | 100.0% | 75.0% | 20.0% | 29.2% | 38.0% | 100.0% | 100.0% | 100.0% | 69.1% | 0ms |
| de-check-freshness | data_engineer | jaffle-shop | 100.0% | 100.0% | 16.7% | 37.5% | 73.3% | 100.0% | 100.0% | 100.0% | 77.6% | 0ms |
| de-blast-radius | data_engineer | jaffle-shop | 100.0% | 33.3% | 10.7% | 45.8% | 72.1% | 100.0% | 0.0% | 100.0% | 56.1% | 0ms |
| de-generate-pipeline | data_engineer | jaffle-shop | 100.0% | 0.0% | 0.0% | 8.3% | 70.0% | 100.0% | 0.0% | 100.0% | 45.2% | 0ms |
| de-run-quality-check | data_engineer | jaffle-shop | 100.0% | 100.0% | 20.0% | 25.0% | 76.0% | 100.0% | 100.0% | 100.0% | 76.7% | 2ms |
| de-detect-schema-changes | data_engineer | jaffle-shop | 100.0% | 100.0% | 0.0% | 12.5% | 70.0% | 100.0% | 100.0% | 100.0% | 71.7% | 1ms |
| de-validate-pipeline | data_engineer | jaffle-shop | 100.0% | 50.0% | 0.0% | 33.3% | 70.0% | 100.0% | 100.0% | 100.0% | 67.9% | 2ms |
| de-monitor-stream-lag | data_engineer | jaffle-shop | 0.0% | 0.0% | 100.0% | 0.0% | 30.0% | 100.0% | 0.0% | 100.0% | 38.9% | 0ms |
| de-cross-platform-search | data_engineer | jaffle-shop | 100.0% | 100.0% | 15.2% | 50.0% | 73.9% | 100.0% | 100.0% | 100.0% | 79.1% | 1ms |
| de-diagnose-incident | data_engineer | jaffle-shop | 100.0% | 66.7% | 5.4% | 75.0% | 72.1% | 100.0% | 50.0% | 100.0% | 70.0% | 2ms |
| ms-safe-schema-migration | data_engineer | jaffle-shop | 100.0% | 60.0% | 4.5% | 87.5% | 70.9% | 100.0% | 0.0% | 100.0% | 64.0% | 0ms |
| ms-investigate-pipeline-failure | data_engineer | jaffle-shop | 100.0% | 60.0% | 5.7% | 83.3% | 72.0% | 100.0% | 50.0% | 100.0% | 70.2% | 0ms |
| neg-search-nonexistent-table | data_engineer | jaffle-shop | 100.0% | 100.0% | 14.3% | 37.5% | 70.0% | 75.0% | 100.0% | 100.0% | 74.3% | 0ms |
| neg-lineage-nonexistent-asset | data_engineer | jaffle-shop | 100.0% | 100.0% | 0.0% | 29.2% | 70.0% | 50.0% | 100.0% | 100.0% | 68.9% | 0ms |
| neg-empty-customer-id | data_engineer | jaffle-shop | 100.0% | 100.0% | 14.3% | 37.5% | 70.0% | 50.0% | 100.0% | 100.0% | 71.8% | 0ms |
| neg-special-chars-query | data_engineer | jaffle-shop | 100.0% | 100.0% | 14.3% | 37.5% | 70.0% | 50.0% | 100.0% | 100.0% | 71.8% | 0ms |
| neg-very-long-query | data_engineer | jaffle-shop | 100.0% | 100.0% | 14.3% | 37.5% | 70.0% | 50.0% | 100.0% | 100.0% | 71.8% | 0ms |
| neg-diagnose-empty-signals | data_engineer | jaffle-shop | 100.0% | 100.0% | 0.0% | 75.0% | 70.0% | 62.5% | 100.0% | 100.0% | 76.1% | 0ms |
| de-search-customer-tables | data_engineer | openmetadata | 100.0% | 100.0% | 13.6% | 50.0% | 71.4% | 100.0% | 100.0% | 100.0% | 78.5% | 0ms |
| de-search-revenue-data | data_engineer | openmetadata | 100.0% | 50.0% | 11.4% | 50.0% | 0.0% | 100.0% | 100.0% | 100.0% | 62.5% | 0ms |
| de-trace-orders-lineage | data_engineer | openmetadata | 100.0% | 100.0% | 15.0% | 29.2% | 73.0% | 100.0% | 100.0% | 100.0% | 76.2% | 0ms |
| de-check-freshness | data_engineer | openmetadata | 100.0% | 100.0% | 11.1% | 37.5% | 73.3% | 100.0% | 100.0% | 100.0% | 76.9% | 0ms |
| de-run-quality-check | data_engineer | openmetadata | 100.0% | 100.0% | 10.0% | 25.0% | 76.0% | 100.0% | 100.0% | 100.0% | 75.4% | 0ms |
| de-cross-platform-search | data_engineer | openmetadata | 100.0% | 100.0% | 13.0% | 50.0% | 73.9% | 100.0% | 100.0% | 100.0% | 78.8% | 0ms |
| neg-search-nonexistent-table | data_engineer | openmetadata | 100.0% | 100.0% | 21.4% | 37.5% | 70.0% | 75.0% | 100.0% | 100.0% | 75.3% | 0ms |
| neg-lineage-nonexistent-asset | data_engineer | openmetadata | 100.0% | 100.0% | 0.0% | 29.2% | 70.0% | 50.0% | 100.0% | 100.0% | 68.9% | 0ms |
| ae-explain-orders-table | analytics_engineer | jaffle-shop | 100.0% | 66.7% | 13.6% | 75.0% | 2.6% | 100.0% | 100.0% | 100.0% | 68.5% | 6ms |
| ae-set-sla | analytics_engineer | jaffle-shop | 100.0% | 100.0% | 10.5% | 70.8% | 71.6% | 100.0% | 100.0% | 100.0% | 80.9% | 0ms |
| ae-generate-docs | analytics_engineer | jaffle-shop | 100.0% | 50.0% | 50.0% | 20.8% | 85.0% | 100.0% | 0.0% | 100.0% | 61.8% | 1ms |
| ae-get-anomalies | analytics_engineer | jaffle-shop | 100.0% | 100.0% | 0.0% | 20.8% | 70.0% | 100.0% | 100.0% | 100.0% | 72.8% | 0ms |
| ae-validate-schema-compat | analytics_engineer | jaffle-shop | 100.0% | 0.0% | 0.0% | 45.8% | 0.0% | 100.0% | 0.0% | 100.0% | 41.0% | 0ms |
| ae-resolve-metric | analytics_engineer | jaffle-shop | 100.0% | 33.3% | 16.7% | 0.0% | 75.0% | 100.0% | 0.0% | 100.0% | 51.2% | 0ms |
| ae-quality-score | analytics_engineer | jaffle-shop | 100.0% | 100.0% | 25.0% | 0.0% | 77.5% | 100.0% | 100.0% | 100.0% | 74.3% | 0ms |
| ae-define-business-rule | analytics_engineer | jaffle-shop | 100.0% | 66.7% | 16.7% | 8.3% | 73.3% | 100.0% | 50.0% | 100.0% | 63.0% | 0ms |
| ae-list-semantic-defs | analytics_engineer | jaffle-shop | 100.0% | 100.0% | 12.5% | 12.5% | 70.0% | 100.0% | 100.0% | 100.0% | 73.3% | 0ms |
| ae-dbt-model-lineage | analytics_engineer | jaffle-shop | 100.0% | 66.7% | 33.3% | 0.0% | 80.0% | 100.0% | 0.0% | 100.0% | 58.4% | 0ms |
| ae-check-staleness | analytics_engineer | jaffle-shop | 100.0% | 50.0% | 9.1% | 70.8% | 72.7% | 100.0% | 0.0% | 100.0% | 61.3% | 0ms |
| ae-import-tribal-knowledge | analytics_engineer | jaffle-shop | 100.0% | 50.0% | 0.0% | 12.5% | 0.0% | 100.0% | 100.0% | 100.0% | 56.1% | 0ms |
| ms-setup-revenue-monitoring | analytics_engineer | jaffle-shop | 100.0% | 80.0% | 10.4% | 70.8% | 1.9% | 100.0% | 100.0% | 100.0% | 69.2% | 0ms |
| neg-explain-nonexistent-table | analytics_engineer | jaffle-shop | 100.0% | 100.0% | 0.0% | 37.5% | 70.0% | 75.0% | 100.0% | 100.0% | 72.5% | 0ms |
| neg-resolve-nonexistent-metric | analytics_engineer | jaffle-shop | 100.0% | 100.0% | 0.0% | 0.0% | 70.0% | 87.5% | 100.0% | 100.0% | 68.8% | 0ms |
| ae-explain-orders-table | analytics_engineer | openmetadata | 100.0% | 100.0% | 7.9% | 75.0% | 71.7% | 100.0% | 100.0% | 100.0% | 81.1% | 0ms |
| ae-get-anomalies | analytics_engineer | openmetadata | 100.0% | 100.0% | 12.5% | 20.8% | 70.0% | 100.0% | 100.0% | 100.0% | 74.4% | 0ms |
| ae-quality-score | analytics_engineer | openmetadata | 100.0% | 100.0% | 12.5% | 0.0% | 77.5% | 100.0% | 100.0% | 100.0% | 72.7% | 0ms |
| dpl-cost-dashboard | data_platform_lead | jaffle-shop | 0.0% | 0.0% | 100.0% | 0.0% | 100.0% | 100.0% | 0.0% | 100.0% | 48.0% | 0ms |
| dpl-estimate-savings | data_platform_lead | jaffle-shop | 0.0% | 0.0% | 100.0% | 0.0% | 100.0% | 100.0% | 0.0% | 100.0% | 48.0% | 0ms |
| dpl-find-unused-data | data_platform_lead | jaffle-shop | 0.0% | 0.0% | 100.0% | 0.0% | 100.0% | 100.0% | 0.0% | 100.0% | 48.0% | 0ms |
| dpl-scan-pii | data_platform_lead | jaffle-shop | 100.0% | 33.3% | 14.3% | 20.8% | 74.3% | 100.0% | 0.0% | 100.0% | 53.6% | 1ms |
| dpl-audit-report | data_platform_lead | jaffle-shop | 100.0% | 0.0% | 5.8% | 50.0% | 73.5% | 100.0% | 0.0% | 100.0% | 51.8% | 0ms |
| dpl-adoption-dashboard | data_platform_lead | jaffle-shop | 100.0% | 50.0% | 5.7% | 58.3% | 70.6% | 100.0% | 50.0% | 100.0% | 65.5% | 7ms |
| dpl-check-agent-health | data_platform_lead | jaffle-shop | 100.0% | 50.0% | 8.3% | 33.3% | 72.5% | 100.0% | 50.0% | 100.0% | 62.8% | 0ms |
| dpl-provision-access | data_platform_lead | jaffle-shop | 100.0% | 50.0% | 6.3% | 41.7% | 71.9% | 100.0% | 50.0% | 100.0% | 63.6% | 1ms |
| dpl-check-policy | data_platform_lead | jaffle-shop | 100.0% | 50.0% | 6.3% | 33.3% | 73.8% | 100.0% | 50.0% | 100.0% | 62.7% | 1ms |
| dpl-recommend-archival | data_platform_lead | jaffle-shop | 0.0% | 0.0% | 100.0% | 0.0% | 100.0% | 100.0% | 0.0% | 100.0% | 48.0% | 0ms |
| ms-optimize-platform-costs | data_platform_lead | jaffle-shop | 0.0% | 0.0% | 100.0% | 0.0% | 100.0% | 100.0% | 0.0% | 100.0% | 48.0% | 0ms |
| neg-blast-radius-nonexistent | data_platform_lead | jaffle-shop | 100.0% | 100.0% | 0.0% | 45.8% | 70.0% | 87.5% | 100.0% | 100.0% | 74.8% | 0ms |
| dpl-scan-pii | data_platform_lead | openmetadata | 100.0% | 33.3% | 7.1% | 20.8% | 74.3% | 100.0% | 0.0% | 100.0% | 52.6% | 0ms |
| ds-nl-query-top-customers | data_scientist | jaffle-shop | 0.0% | 0.0% | 100.0% | 0.0% | 100.0% | 100.0% | 0.0% | 100.0% | 48.0% | 0ms |
| ds-generate-insight-revenue | data_scientist | jaffle-shop | 0.0% | 0.0% | 100.0% | 0.0% | 100.0% | 100.0% | 0.0% | 100.0% | 48.0% | 0ms |
| ds-explain-anomaly | data_scientist | jaffle-shop | 0.0% | 0.0% | 100.0% | 0.0% | 100.0% | 100.0% | 0.0% | 100.0% | 48.0% | 0ms |
| ds-search-ml-features | data_scientist | jaffle-shop | 100.0% | 100.0% | 11.4% | 50.0% | 71.4% | 100.0% | 100.0% | 100.0% | 78.3% | 1ms |
| ds-get-context-orders | data_scientist | jaffle-shop | 100.0% | 50.0% | 25.0% | 0.0% | 77.5% | 100.0% | 0.0% | 100.0% | 54.8% | 0ms |
| ds-nl-query-engagement | data_scientist | jaffle-shop | 0.0% | 0.0% | 100.0% | 0.0% | 100.0% | 100.0% | 0.0% | 100.0% | 48.0% | 0ms |
| ds-export-results | data_scientist | jaffle-shop | 0.0% | 0.0% | 100.0% | 0.0% | 100.0% | 100.0% | 0.0% | 100.0% | 48.0% | 0ms |
| ds-search-events | data_scientist | jaffle-shop | 100.0% | 50.0% | 14.3% | 37.5% | 0.0% | 100.0% | 100.0% | 100.0% | 61.2% | 0ms |
| ds-correlate-metadata | data_scientist | jaffle-shop | 100.0% | 50.0% | 22.7% | 25.0% | 74.5% | 100.0% | 0.0% | 100.0% | 57.4% | 1ms |
| ds-estimate-query-cost | data_scientist | jaffle-shop | 0.0% | 0.0% | 100.0% | 0.0% | 100.0% | 100.0% | 0.0% | 100.0% | 48.0% | 0ms |
| ds-golden-path | data_scientist | jaffle-shop | 100.0% | 100.0% | 20.0% | 45.8% | 76.0% | 100.0% | 100.0% | 100.0% | 79.4% | 0ms |
| ds-analyze-query-history | data_scientist | jaffle-shop | 100.0% | 50.0% | 10.0% | 12.5% | 73.0% | 100.0% | 0.0% | 100.0% | 53.9% | 0ms |
| neg-sql-injection-search | data_scientist | jaffle-shop | 100.0% | 100.0% | 14.3% | 37.5% | 70.0% | 50.0% | 100.0% | 100.0% | 71.8% | 0ms |
| ds-nl-query-top-customers | data_scientist | openmetadata | 0.0% | 0.0% | 100.0% | 0.0% | 100.0% | 100.0% | 0.0% | 100.0% | 48.0% | 0ms |
| ds-search-ml-features | data_scientist | openmetadata | 100.0% | 100.0% | 13.6% | 50.0% | 71.4% | 100.0% | 100.0% | 100.0% | 78.5% | 0ms |
| ds-get-context-orders | data_scientist | openmetadata | 100.0% | 50.0% | 12.5% | 0.0% | 77.5% | 100.0% | 0.0% | 100.0% | 53.2% | 0ms |
| ds-search-events | data_scientist | openmetadata | 100.0% | 50.0% | 21.4% | 37.5% | 0.0% | 100.0% | 100.0% | 100.0% | 62.2% | 0ms |
| ml-suggest-features | ml_engineer | jaffle-shop | 100.0% | 0.0% | 100.0% | 0.0% | 100.0% | 100.0% | 0.0% | 100.0% | 61.0% | 0ms |
| ml-select-model | ml_engineer | jaffle-shop | 100.0% | 0.0% | 100.0% | 0.0% | 100.0% | 100.0% | 0.0% | 100.0% | 61.0% | 0ms |
| ml-train-model | ml_engineer | jaffle-shop | 100.0% | 0.0% | 0.0% | 0.0% | 70.0% | 100.0% | 0.0% | 100.0% | 44.1% | 0ms |
| ml-evaluate-model | ml_engineer | jaffle-shop | 100.0% | 0.0% | 0.0% | 0.0% | 70.0% | 100.0% | 0.0% | 100.0% | 44.1% | 0ms |
| ml-deploy-model | ml_engineer | jaffle-shop | 100.0% | 0.0% | 0.0% | 8.3% | 70.0% | 100.0% | 0.0% | 100.0% | 45.2% | 0ms |
| ml-check-data-quality | ml_engineer | jaffle-shop | 100.0% | 100.0% | 20.0% | 25.0% | 76.0% | 100.0% | 100.0% | 100.0% | 76.7% | 0ms |
| ml-search-training-data | ml_engineer | jaffle-shop | 100.0% | 50.0% | 14.3% | 37.5% | 0.0% | 100.0% | 100.0% | 100.0% | 61.2% | 0ms |
| ml-check-freshness-for-training | ml_engineer | jaffle-shop | 100.0% | 100.0% | 16.7% | 37.5% | 73.3% | 100.0% | 100.0% | 100.0% | 77.6% | 0ms |
| ml-generate-feature-pipeline | ml_engineer | jaffle-shop | 100.0% | 0.0% | 0.0% | 8.3% | 70.0% | 100.0% | 0.0% | 100.0% | 45.2% | 0ms |
| ml-detect-drift | ml_engineer | jaffle-shop | 100.0% | 0.0% | 5.6% | 37.5% | 70.0% | 100.0% | 0.0% | 100.0% | 49.7% | 1ms |
| ml-check-data-quality | ml_engineer | openmetadata | 100.0% | 100.0% | 10.0% | 25.0% | 76.0% | 100.0% | 100.0% | 100.0% | 75.4% | 0ms |
| ocu-search-tables | openclaw_user | jaffle-shop | 100.0% | 100.0% | 16.1% | 58.3% | 73.2% | 100.0% | 100.0% | 100.0% | 80.2% | 0ms |
| ocu-explain-table | openclaw_user | jaffle-shop | 100.0% | 100.0% | 8.6% | 58.3% | 70.5% | 100.0% | 100.0% | 100.0% | 78.9% | 0ms |
| ocu-view-lineage | openclaw_user | jaffle-shop | 100.0% | 100.0% | 20.0% | 29.2% | 73.0% | 100.0% | 100.0% | 100.0% | 76.9% | 0ms |
| ocu-check-freshness | openclaw_user | jaffle-shop | 100.0% | 100.0% | 16.7% | 37.5% | 73.3% | 100.0% | 100.0% | 100.0% | 77.6% | 0ms |
| ocu-get-context | openclaw_user | jaffle-shop | 100.0% | 50.0% | 8.8% | 58.3% | 70.7% | 100.0% | 0.0% | 100.0% | 59.4% | 0ms |
| ocu-resolve-metric | openclaw_user | jaffle-shop | 100.0% | 33.3% | 16.7% | 0.0% | 75.0% | 100.0% | 0.0% | 100.0% | 51.2% | 0ms |
| ocu-quality-score | openclaw_user | jaffle-shop | 100.0% | 100.0% | 25.0% | 0.0% | 77.5% | 100.0% | 100.0% | 100.0% | 74.3% | 0ms |
| ocu-cross-platform-search | openclaw_user | jaffle-shop | 100.0% | 50.0% | 11.8% | 41.7% | 3.5% | 100.0% | 100.0% | 100.0% | 61.9% | 0ms |
| ocu-list-semantics | openclaw_user | jaffle-shop | 100.0% | 100.0% | 12.5% | 12.5% | 70.0% | 100.0% | 100.0% | 100.0% | 73.3% | 0ms |
| ocu-get-documentation | openclaw_user | jaffle-shop | 100.0% | 50.0% | 13.6% | 37.5% | 71.4% | 100.0% | 0.0% | 100.0% | 57.4% | 0ms |
| ocu-search-tables | openclaw_user | openmetadata | 100.0% | 100.0% | 14.3% | 58.3% | 73.2% | 100.0% | 100.0% | 100.0% | 80.0% | 0ms |
| ocu-explain-table | openclaw_user | openmetadata | 100.0% | 100.0% | 6.9% | 58.3% | 70.5% | 100.0% | 100.0% | 100.0% | 78.6% | 0ms |
| ocu-view-lineage | openclaw_user | openmetadata | 100.0% | 100.0% | 15.0% | 29.2% | 73.0% | 100.0% | 100.0% | 100.0% | 76.2% | 0ms |
| ocu-check-freshness | openclaw_user | openmetadata | 100.0% | 100.0% | 11.1% | 37.5% | 73.3% | 100.0% | 100.0% | 100.0% | 76.9% | 0ms |
| ocu-get-context | openclaw_user | openmetadata | 100.0% | 50.0% | 6.3% | 58.3% | 70.7% | 100.0% | 0.0% | 100.0% | 59.1% | 0ms |
| ocu-quality-score | openclaw_user | openmetadata | 100.0% | 100.0% | 12.5% | 0.0% | 77.5% | 100.0% | 100.0% | 100.0% | 72.7% | 0ms |
| ocu-cross-platform-search | openclaw_user | openmetadata | 100.0% | 50.0% | 8.8% | 41.7% | 0.0% | 100.0% | 100.0% | 100.0% | 61.1% | 0ms |
| gov-scan-pii-customers | governance_officer | jaffle-shop | 100.0% | 33.3% | 14.3% | 20.8% | 74.3% | 100.0% | 0.0% | 100.0% | 53.6% | 0ms |
| gov-generate-audit-report | governance_officer | jaffle-shop | 100.0% | 0.0% | 7.1% | 50.0% | 72.9% | 100.0% | 0.0% | 100.0% | 51.9% | 0ms |
| gov-check-policy-compliance | governance_officer | jaffle-shop | 100.0% | 50.0% | 6.3% | 33.3% | 73.8% | 100.0% | 50.0% | 100.0% | 62.7% | 0ms |
| gov-enforce-rbac | governance_officer | jaffle-shop | 100.0% | 0.0% | 8.3% | 37.5% | 72.5% | 100.0% | 0.0% | 100.0% | 50.4% | 0ms |
| gov-provision-access | governance_officer | jaffle-shop | 100.0% | 50.0% | 6.3% | 41.7% | 71.9% | 100.0% | 50.0% | 100.0% | 63.6% | 0ms |
| gov-lineage-audit | governance_officer | jaffle-shop | 100.0% | 100.0% | 20.0% | 29.2% | 73.0% | 100.0% | 100.0% | 100.0% | 76.9% | 0ms |
| gov-blast-radius-customers | governance_officer | jaffle-shop | 100.0% | 33.3% | 11.5% | 54.2% | 72.3% | 100.0% | 0.0% | 100.0% | 57.3% | 0ms |
| gov-quality-check-compliance | governance_officer | jaffle-shop | 100.0% | 100.0% | 20.0% | 25.0% | 76.0% | 100.0% | 100.0% | 100.0% | 76.7% | 0ms |
| gov-search-sensitive-data | governance_officer | jaffle-shop | 100.0% | 100.0% | 11.4% | 50.0% | 71.4% | 100.0% | 100.0% | 100.0% | 78.3% | 0ms |
| gov-schema-change-impact | governance_officer | jaffle-shop | 100.0% | 0.0% | 0.0% | 45.8% | 0.0% | 100.0% | 0.0% | 100.0% | 41.0% | 0ms |
| ms-soc2-audit-prep | governance_officer | jaffle-shop | 100.0% | 50.0% | 6.3% | 70.8% | 72.5% | 100.0% | 0.0% | 100.0% | 60.9% | 1ms |
| neg-policy-deny-write | governance_officer | jaffle-shop | 100.0% | 50.0% | 9.1% | 33.3% | 75.5% | 75.0% | 100.0% | 100.0% | 67.3% | 0ms |
| neg-provision-unauthorized-admin | governance_officer | jaffle-shop | 100.0% | 100.0% | 0.0% | 33.3% | 70.0% | 75.0% | 100.0% | 100.0% | 71.9% | 0ms |
| neg-pii-scan-nonexistent-table | governance_officer | jaffle-shop | 100.0% | 100.0% | 0.0% | 20.8% | 70.0% | 100.0% | 100.0% | 100.0% | 72.8% | 0ms |
| gov-scan-pii-customers | governance_officer | openmetadata | 100.0% | 33.3% | 7.1% | 20.8% | 74.3% | 100.0% | 0.0% | 100.0% | 52.6% | 0ms |
| gov-lineage-audit | governance_officer | openmetadata | 100.0% | 100.0% | 20.0% | 29.2% | 73.0% | 100.0% | 100.0% | 100.0% | 76.9% | 0ms |
| gov-quality-check-compliance | governance_officer | openmetadata | 100.0% | 100.0% | 10.0% | 25.0% | 76.0% | 100.0% | 100.0% | 100.0% | 75.4% | 0ms |
| gov-search-sensitive-data | governance_officer | openmetadata | 100.0% | 100.0% | 13.6% | 50.0% | 71.4% | 100.0% | 100.0% | 100.0% | 78.5% | 0ms |
| dp-discover-data | data_practitioner | jaffle-shop | 100.0% | 25.0% | 14.3% | 37.5% | 0.0% | 100.0% | 100.0% | 100.0% | 58.0% | 0ms |
| dp-understand-orders | data_practitioner | jaffle-shop | 100.0% | 66.7% | 13.6% | 75.0% | 2.6% | 100.0% | 100.0% | 100.0% | 68.5% | 0ms |
| dp-check-quality | data_practitioner | jaffle-shop | 100.0% | 100.0% | 25.0% | 0.0% | 77.5% | 100.0% | 100.0% | 100.0% | 74.3% | 0ms |
| dp-simple-lineage | data_practitioner | jaffle-shop | 100.0% | 100.0% | 20.0% | 29.2% | 73.0% | 100.0% | 100.0% | 100.0% | 76.9% | 0ms |
| dp-nl-query | data_practitioner | jaffle-shop | 0.0% | 0.0% | 100.0% | 0.0% | 100.0% | 100.0% | 0.0% | 100.0% | 48.0% | 0ms |
| dp-check-anomalies | data_practitioner | jaffle-shop | 100.0% | 100.0% | 0.0% | 20.8% | 70.0% | 100.0% | 100.0% | 100.0% | 72.8% | 0ms |
| dp-get-full-context | data_practitioner | jaffle-shop | 100.0% | 50.0% | 25.0% | 0.0% | 77.5% | 100.0% | 0.0% | 100.0% | 54.8% | 0ms |
| dp-read-docs | data_practitioner | jaffle-shop | 100.0% | 50.0% | 13.6% | 37.5% | 71.4% | 100.0% | 0.0% | 100.0% | 57.4% | 0ms |
| ms-new-member-onboarding | data_practitioner | jaffle-shop | 100.0% | 100.0% | 13.9% | 75.0% | 72.5% | 100.0% | 100.0% | 100.0% | 82.0% | 0ms |
| neg-quality-nonexistent-dataset | data_practitioner | jaffle-shop | 100.0% | 100.0% | 0.0% | 25.0% | 70.0% | 75.0% | 100.0% | 100.0% | 70.9% | 0ms |
| neg-search-empty-query | data_practitioner | jaffle-shop | 100.0% | 100.0% | 21.9% | 58.3% | 75.6% | 25.0% | 100.0% | 100.0% | 73.8% | 0ms |
| dp-discover-data | data_practitioner | openmetadata | 100.0% | 25.0% | 21.4% | 37.5% | 0.0% | 100.0% | 100.0% | 100.0% | 58.9% | 0ms |
| dp-understand-orders | data_practitioner | openmetadata | 100.0% | 100.0% | 7.9% | 75.0% | 71.7% | 100.0% | 100.0% | 100.0% | 81.1% | 0ms |
| dp-check-quality | data_practitioner | openmetadata | 100.0% | 100.0% | 12.5% | 0.0% | 77.5% | 100.0% | 100.0% | 100.0% | 72.7% | 0ms |
| dp-simple-lineage | data_practitioner | openmetadata | 100.0% | 100.0% | 20.0% | 29.2% | 73.0% | 100.0% | 100.0% | 100.0% | 76.9% | 0ms |
| dp-check-anomalies | data_practitioner | openmetadata | 100.0% | 100.0% | 12.5% | 20.8% | 70.0% | 100.0% | 100.0% | 100.0% | 74.4% | 0ms |
| dp-get-full-context | data_practitioner | openmetadata | 100.0% | 50.0% | 25.0% | 0.0% | 77.5% | 100.0% | 0.0% | 100.0% | 54.8% | 0ms |
| ms-new-member-onboarding | data_practitioner | openmetadata | 100.0% | 100.0% | 9.0% | 75.0% | 71.8% | 100.0% | 100.0% | 100.0% | 81.3% | 0ms |

## Errors

- **de-monitor-stream-lag** (jaffle-shop): Unknown agent: dw-streaming
- **dpl-cost-dashboard** (jaffle-shop): Unknown agent: dw-cost
- **dpl-estimate-savings** (jaffle-shop): Unknown agent: dw-cost
- **dpl-find-unused-data** (jaffle-shop): Unknown agent: dw-cost
- **dpl-recommend-archival** (jaffle-shop): Unknown agent: dw-cost
- **ms-optimize-platform-costs** (jaffle-shop): Unknown agent: dw-cost
- **ds-nl-query-top-customers** (jaffle-shop): Unknown agent: dw-insights
- **ds-generate-insight-revenue** (jaffle-shop): Unknown agent: dw-insights
- **ds-explain-anomaly** (jaffle-shop): Unknown agent: dw-insights
- **ds-nl-query-engagement** (jaffle-shop): Unknown agent: dw-insights
- **ds-export-results** (jaffle-shop): Unknown agent: dw-insights
- **ds-estimate-query-cost** (jaffle-shop): Unknown agent: dw-cost
- **ds-nl-query-top-customers** (openmetadata): Unknown agent: dw-insights
- **dp-nl-query** (jaffle-shop): Unknown agent: dw-insights

