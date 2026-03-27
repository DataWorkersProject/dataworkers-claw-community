# Benchmark Report -- 

**Date:** 2026-03-27
**Scenarios:** 28
**Pass rate:** 96.4%
**Avg latency:** 71.6ms
**Avg completeness:** 67.9%
**Avg consistency:** 96.4%

## Agent Summary

| Agent | Scenarios | Pass Rate | Avg Latency | Completeness | Consistency | Quality | Grade |
|-------|----------:|----------:|------------:|-------------:|------------:|--------:|-------|
| dw-context-catalog | 8 | 87.5% | 0.1ms | 87.5% | 87.5% | 100.0% | B |
| dw-governance | 5 | 100.0% | 0.1ms | 80.0% | 100.0% | 66.7% | B |
| dw-incidents | 5 | 100.0% | 400.5ms | 60.0% | 100.0% | 100.0% | B |
| dw-pipelines | 5 | 100.0% | 0.0ms | 20.0% | 100.0% | 42.9% | D |
| dw-quality | 5 | 100.0% | 0.0ms | 80.0% | 100.0% | 100.0% | A |

## By Category

| Category | Scenarios | Pass Rate | Avg Latency | Completeness |
|----------|----------:|----------:|------------:|-------------:|
| analysis | 10 | 100.0% | 200.3ms | 90.0% |
| generation | 5 | 80.0% | 0.2ms | 40.0% |
| monitoring | 3 | 100.0% | 0.1ms | 33.3% |
| mutation | 5 | 100.0% | 0.0ms | 80.0% |
| search | 5 | 100.0% | 0.1ms | 60.0% |

## By Difficulty

| Difficulty | Scenarios | Pass Rate |
|------------|----------:|----------:|
| basic | 15 | 100.0% |
| intermediate | 10 | 90.0% |
| advanced | 3 | 100.0% |

## Detailed Results

### dw-context-catalog (7/8 passed)

| Scenario | Tool | Latency | Complete | Consistent | Quality | Status |
|----------|------|--------:|---------:|-----------:|--------:|--------|
| catalog-search-basic | search_datasets | 0.3ms | 100.0% | 100.0% | 100.0% | PASS |
| catalog-get-context | get_context | 0.0ms | 100.0% | 100.0% | 100.0% | PASS |
| catalog-get-lineage | get_lineage | 0.1ms | 100.0% | 100.0% | 100.0% | PASS |
| catalog-check-freshness | check_freshness | 0.0ms | 100.0% | 100.0% | n/a | PASS |
| catalog-blast-radius | blast_radius_analysis | 0.0ms | 100.0% | 100.0% | n/a | PASS |
| catalog-generate-docs | generate_documentation | 0.1ms | 0.0% | 0.0% | n/a | FAIL -- Unexpected token '#', "# fact_ord"... is not valid JSON |
| catalog-cross-platform-search | search_across_platforms | 0.1ms | 100.0% | 100.0% | 100.0% | PASS |
| catalog-define-business-rule | define_business_rule | 0.1ms | 100.0% | 100.0% | 100.0% | PASS |

### dw-pipelines (5/5 passed)

| Scenario | Tool | Latency | Complete | Consistent | Quality | Status |
|----------|------|--------:|---------:|-----------:|--------:|--------|
| pipelines-list-templates | list_pipeline_templates | 0.0ms | 0.0% | 100.0% | 100.0% | PASS |
| pipelines-generate-basic | generate_pipeline | 0.0ms | 0.0% | 100.0% | 0.0% | PASS |
| pipelines-validate | validate_pipeline | 0.1ms | 100.0% | 100.0% | 100.0% | PASS |
| pipelines-deploy | deploy_pipeline | 0.0ms | 0.0% | 100.0% | 0.0% | PASS |
| pipelines-generate-complex | generate_pipeline | 0.0ms | 0.0% | 100.0% | 0.0% | PASS |

### dw-quality (5/5 passed)

| Scenario | Tool | Latency | Complete | Consistent | Quality | Status |
|----------|------|--------:|---------:|-----------:|--------:|--------|
| quality-run-check | run_quality_check | 0.1ms | 100.0% | 100.0% | 100.0% | PASS |
| quality-get-score | get_quality_score | 0.0ms | 100.0% | 100.0% | n/a | PASS |
| quality-get-anomalies | get_anomalies | 0.0ms | 0.0% | 100.0% | n/a | PASS |
| quality-set-sla | set_sla | 0.1ms | 100.0% | 100.0% | 100.0% | PASS |
| quality-set-sla-multi-rule | set_sla | 0.0ms | 100.0% | 100.0% | 100.0% | PASS |

### dw-governance (5/5 passed)

| Scenario | Tool | Latency | Complete | Consistent | Quality | Status |
|----------|------|--------:|---------:|-----------:|--------:|--------|
| governance-check-policy | check_policy | 0.3ms | 100.0% | 100.0% | 100.0% | PASS |
| governance-enforce-rbac | enforce_rbac | 0.0ms | 0.0% | 100.0% | 0.0% | PASS |
| governance-provision-access | provision_access | 0.1ms | 100.0% | 100.0% | n/a | PASS |
| governance-scan-pii | scan_pii | 0.1ms | 100.0% | 100.0% | 100.0% | PASS |
| governance-audit-report | generate_audit_report | 0.1ms | 100.0% | 100.0% | n/a | PASS |

### dw-incidents (5/5 passed)

| Scenario | Tool | Latency | Complete | Consistent | Quality | Status |
|----------|------|--------:|---------:|-----------:|--------:|--------|
| incidents-diagnose-basic | diagnose_incident | 0.3ms | 100.0% | 100.0% | 100.0% | PASS |
| incidents-get-history | get_incident_history | 0.1ms | 0.0% | 100.0% | n/a | PASS |
| incidents-root-cause | get_root_cause | 2001.5ms | 100.0% | 100.0% | 100.0% | PASS |
| incidents-remediate | remediate | 0.6ms | 100.0% | 100.0% | 100.0% | PASS |
| incidents-monitor-metrics | monitor_metrics | 0.2ms | 0.0% | 100.0% | n/a | PASS |

## Failed Scenarios

- **catalog-generate-docs** (dw-context-catalog/generate_documentation): Unexpected token '#', "# fact_ord"... is not valid JSON

## Quality Check Failures

- **pipelines-generate-basic** (dw-pipelines): has-name-and-steps -- Empty fields: name, steps
- **pipelines-generate-basic** (dw-pipelines): steps-is-array -- Type mismatches: steps: expected array, got undefined
- **pipelines-deploy** (dw-pipelines): deployment-id-present -- Empty fields: deploymentId
- **pipelines-generate-complex** (dw-pipelines): has-steps -- Type mismatches: steps: expected array, got undefined
- **governance-enforce-rbac** (dw-governance): allowed-is-boolean -- Type mismatches: allowed: expected boolean, got undefined

---
Generated by benchmark framework on 2026-03-27T03:04:55.306Z
