# Data Quality Dimensions Reference

The catalog agent scores every data asset on 6 quality dimensions. The composite `qualityScore` (0.0–1.0) is a weighted sum of individual dimension scores.

## Dimensions

### 1. Accuracy (weight: 20%)
How well the data represents real-world values.

- **Checks:** null-rate, range-violations, referential-integrity, cross-source-match
- **Example:** A `price` column should never be negative; an `email` field should match known customer records.
- **Improvement:** Add constraint checks, set up cross-source validation against a known-good source.

### 2. Completeness (weight: 20%)
How much of the expected data is present.

- **Checks:** null-percentage, row-count-vs-expected, required-field-coverage
- **Example:** If the `orders` table should have 10,000 rows daily but only has 8,000, completeness drops.
- **Improvement:** Monitor row counts, alert on missing partitions, track required field fill rates.

### 3. Consistency (weight: 15%)
Agreement of data across sources and time periods.

- **Checks:** cross-table-agreement, format-conformance, business-rule-compliance
- **Example:** `customer_id` should link to the same person in `orders` and `support_tickets`.
- **Improvement:** Enforce foreign key relationships, standardize formats, reconcile cross-system data regularly.

### 4. Timeliness (weight: 20%)
How current the data is relative to expectations.

- **Checks:** last-updated-vs-sla, refresh-lag, partition-recency
- **Example:** A dashboard SLA requires data no older than 1 hour, but the table hasn't refreshed in 3 hours.
- **Improvement:** Set SLA targets, monitor refresh cadences, alert on staleness.

### 5. Validity (weight: 15%)
Conformance to defined formats, types, and business rules.

- **Checks:** type-conformance, regex-match, enum-membership, length-bounds
- **Example:** A `country_code` field should only contain valid ISO 3166-1 alpha-2 codes.
- **Improvement:** Add schema validation, define allowed value sets, enforce regex patterns.

### 6. Uniqueness (weight: 10%)
Absence of duplicate records on key columns.

- **Checks:** exact-duplicate-rate, primary-key-uniqueness, fuzzy-duplicate-detection
- **Example:** The `users` table should have exactly one row per `user_id`.
- **Improvement:** Add unique constraints, run deduplication pipelines, monitor duplicate rates.

## Composite Score Formula

```
qualityScore = (accuracy × 0.20) + (completeness × 0.20) + (consistency × 0.15)
             + (timeliness × 0.20) + (validity × 0.15) + (uniqueness × 0.10)
```

## Score Interpretation

| Range | Label | Action |
|-------|-------|--------|
| 0.9–1.0 | Excellent | No action needed |
| 0.7–0.9 | Good | Monitor, minor improvements |
| 0.5–0.7 | Fair | Investigate failing dimensions |
| 0.3–0.5 | Poor | Remediation required |
| 0.0–0.3 | Critical | Do not use without cleanup |
