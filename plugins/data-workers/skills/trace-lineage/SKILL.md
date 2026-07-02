---
name: trace-lineage
description: "Trace end-to-end lineage for any table or column across catalogs. Answers 'where does this data come from and what breaks if it changes' with a source-to-consumer chain."
user-invocable: true
argument-hint: "[table or column, e.g. analytics.orders or fct_orders.net_revenue]"
---

# Trace Lineage

Walk a dataset's full upstream and downstream lineage. The user names a target via "$ARGUMENTS".

## Examples

- `/data-workers:trace-lineage analytics.orders`
- `/data-workers:trace-lineage fct_orders.net_revenue`
- `/data-workers:trace-lineage which dashboards break if we drop staging.events?`

## Step 1 — Resolve the asset

If "$ARGUMENTS" is not a fully-qualified name, resolve it first with `mcp__data-workers__search_across_catalogs` (falls back to `mcp__data-workers__search_datasets`). If several assets match, show the candidates and ask which one to trace.

## Step 2 — Trace

- Table-level: `mcp__data-workers__get_lineage`, then `mcp__data-workers__get_lineage_graph` for the full graph when the user wants more than one hop.
- Cross-platform (asset spans catalogs/warehouses): `mcp__data-workers__trace_cross_platform_lineage`.
- dbt models: `mcp__data-workers__get_dbt_model_lineage`.

## Step 3 — Report

Render a source → transform → target chain with one line per hop. Then answer the user's actual question: blast radius for a change, origin of a suspect field, or which consumers to notify. Flag any hop where lineage is missing or inferred rather than recorded — do not present inferred edges as facts.

## Guardrails

- Read-only. Never mutate lineage (`update_lineage` is out of scope for this skill).
- If a required tool errors or the asset cannot be found, say so plainly instead of guessing.
- On first run without warehouse credentials the server uses in-memory sample data (assets like `analytics.orders`) — tell the user when results come from sample data.
