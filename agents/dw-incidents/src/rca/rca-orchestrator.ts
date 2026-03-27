import type { IVectorStore, IRelationalStore } from '@data-workers/infrastructure-stubs';
import type { IncidentType, RootCauseAnalysis, CausalChainLink } from '../types.js';
import type { AnomalyDetection } from '../engine/statistical-detector.js';
import { LineageTraverser } from './lineage-traverser.js';
import { IncidentClassifier } from './incident-classifier.js';
import { HistoryMatcher } from './history-matcher.js';

/**
 * RCA Orchestrator (REQ-INC-002).
 *
 * Coordinates all RCA components to produce a comprehensive
 * root cause analysis report:
 * 1. Classify the incident
 * 2. Traverse lineage graph
 * 3. Query logs and metrics
 * 4. Match against history
 * 5. Build evidence-based RCA report
 *
 * Target: 85% accuracy at GA.
 */
export class RCAOrchestrator {
  private lineageTraverser: LineageTraverser;
  private classifier: IncidentClassifier;
  private historyMatcher: HistoryMatcher;

  constructor(vectorStore: IVectorStore, relationalStore: IRelationalStore) {
    this.lineageTraverser = new LineageTraverser();
    this.classifier = new IncidentClassifier();
    this.historyMatcher = new HistoryMatcher(vectorStore, relationalStore);
  }

  /**
   * Perform full root cause analysis.
   */
  async analyze(
    incidentId: string,
    customerId: string,
    anomalyDetections: AnomalyDetection[],
    affectedResources: string[],
    logPatterns?: string[],
    recentChanges?: string[],
  ): Promise<RootCauseAnalysis> {
    const start = Date.now();

    // Step 1: Classify the incident
    const classification = this.classifier.classify({
      anomalyDetections,
      affectedMetrics: anomalyDetections.map((d) => d.metric),
      logPatterns,
      recentChanges,
    });

    // Step 2: Traverse lineage
    const lineageResult = await this.lineageTraverser.getImpactAnalysis(
      customerId,
      affectedResources[0] ?? 'unknown',
      5,
    );

    // Step 3: Match against history
    const historicalMatches = await this.historyMatcher.findSimilar(
      classification.type,
      affectedResources,
      customerId,
      3,
    );

    // Step 4: Build causal chain
    const causalChain = this.buildCausalChain(
      classification.type,
      affectedResources,
      lineageResult.upstream.path.map((n) => n.name),
      anomalyDetections,
    );

    // Step 5: Determine root cause
    const rootCause = this.determineRootCause(
      classification.type,
      causalChain,
      historicalMatches.length > 0 ? historicalMatches[0].resolutionPattern : undefined,
    );

    return {
      incidentId,
      rootCause,
      causalChain,
      confidence: classification.confidence * 0.9, // Slight discount for uncertainty
      evidenceSources: [
        'lineage_graph',
        'anomaly_detections',
        ...(logPatterns?.length ? ['execution_logs'] : []),
        ...(historicalMatches.length > 0 ? ['incident_history'] : []),
        ...(recentChanges?.length ? ['change_log'] : []),
      ],
      traversalDepth: lineageResult.upstream.depth,
      analysisTimeMs: Date.now() - start,
    };
  }

  private buildCausalChain(
    type: IncidentType,
    affectedResources: string[],
    upstreamEntities: string[],
    detections: AnomalyDetection[],
  ): CausalChainLink[] {
    const chain: CausalChainLink[] = [];

    // Start with the affected resource
    chain.push({
      entity: affectedResources[0] ?? 'unknown',
      entityType: 'table',
      issue: `${type.replace(/_/g, ' ')} detected: ${detections[0]?.metric ?? 'unknown metric'}`,
      confidence: 0.95,
      timestamp: detections[0]?.timestamp ?? Date.now(),
    });

    // Add upstream entities from lineage
    for (let i = 1; i < Math.min(upstreamEntities.length, 4); i++) {
      chain.push({
        entity: upstreamEntities[i],
        entityType: i % 2 === 0 ? 'pipeline' : 'table',
        issue: `Upstream dependency in causal chain`,
        confidence: Math.pow(0.9, i),
      });
    }

    return chain;
  }

  private determineRootCause(
    type: IncidentType,
    chain: CausalChainLink[],
    historicalResolution?: string,
  ): string {
    const deepest = chain[chain.length - 1];
    let rootCause = `${type.replace(/_/g, ' ')}: ${deepest?.issue ?? 'unknown cause'}`;

    if (historicalResolution) {
      rootCause += `. Similar to past incidents resolved via ${historicalResolution}.`;
    }

    return rootCause;
  }

  getClassifier(): IncidentClassifier {
    return this.classifier;
  }

  getHistoryMatcher(): HistoryMatcher {
    return this.historyMatcher;
  }
}
