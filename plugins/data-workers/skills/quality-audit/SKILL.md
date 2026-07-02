---
name: quality-audit
description: "Run a full data-quality audit on a table or pipeline: quality score, rule checks, anomalies with context, and concrete fixes ranked by impact."
user-invocable: true
argument-hint: "[table or pipeline, e.g. analytics.orders]"
---

# Quality Audit

Audit a dataset's health end to end. The user names a target via "$ARGUMENTS".

## Examples

- `/data-workers:quality-audit analytics.orders`
- `/data-workers:quality-audit did anything drift in staging.customers this week?`

## Step 1 — Baseline

Call `mcp__data-workers__get_quality_score` for the current weighted score, then `mcp__data-workers__get_quality_summary` for the dimension breakdown (completeness, freshness, validity, consistency, uniqueness).

## Step 2 — Check and explain

- `mcp__data-workers__run_quality_check` to execute the active rules against the target.
- `mcp__data-workers__get_anomalies` for statistical outliers, then `mcp__data-workers__get_anomaly_context` on each significant anomaly so the report explains *why* it fired, not just that it fired.

## Step 3 — Recommend

Report: score with trend, failed rules with affected row counts, anomalies with context, then 2-3 concrete next steps ranked by impact. If the target is a pipeline output, offer `mcp__data-workers__create_quality_tests_for_pipeline` to codify the missing checks — ask before creating anything.

## Guardrails

- Creating tests or SLAs changes state — always confirm with the user first.
- Never invent scores or row counts; report only what the tools return.
- On first run without warehouse credentials the server uses in-memory sample data — say so when reporting.
