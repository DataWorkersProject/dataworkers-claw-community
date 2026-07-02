---
name: incident-rca
description: "Walk a data incident from symptom to root cause: correlate the anomaly, trace the failing upstream job, and produce a root-cause narrative with the evidence chain."
user-invocable: true
argument-hint: "[symptom, e.g. orders table row count dropped 40% yesterday]"
---

# Incident Root-Cause Analysis

Diagnose a data incident. The user describes the symptom via "$ARGUMENTS".

## Examples

- `/data-workers:incident-rca orders row count dropped 40% overnight`
- `/data-workers:incident-rca the revenue dashboard is showing nulls since Tuesday`

## Step 1 — Diagnose

Call `mcp__data-workers__diagnose_incident` with the symptom. Pull `mcp__data-workers__get_incident_history` to check whether this is a recurrence — a repeat incident changes the recommendation from "fix" to "fix the class of failure".

## Step 2 — Root cause

`mcp__data-workers__get_root_cause` for the causal chain. Where the chain crosses datasets, corroborate with `mcp__data-workers__get_lineage` so the blamed upstream is actually upstream. Use `mcp__data-workers__get_anomalies` on the affected table to bound when the corruption started.

## Step 3 — Report

Produce: (1) one-line root cause, (2) the evidence chain from symptom back to cause with timestamps, (3) blast radius (downstream consumers from lineage), (4) recommended fix and whether it recurs. Distinguish confirmed evidence from inference explicitly.

## Guardrails

- Read-only diagnosis. Never execute remediations, restarts, or writes — recommend them for a human to run.
- If the tools cannot establish a root cause, say what was ruled out and what evidence is missing instead of forcing a conclusion.
- On first run without warehouse credentials the server uses in-memory sample data — say so when reporting.
