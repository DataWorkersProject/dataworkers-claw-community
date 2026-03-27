import type { IncidentType, CausalChainLink } from '../types.js';

/**
 * Root Cause Analysis Engine (REQ-INC-002).
 *
 * Encapsulates causal chain construction, issue description generation,
 * root cause identification, and RCA confidence calculation.
 * Graph traversal results are passed in; this engine handles only business logic.
 */

export interface UpstreamEntry {
  node: { id: string; name: string; type: string };
  depth: number;
  relationship: string;
}

export interface SimilarIncident {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

export class RootCauseEngine {
  /**
   * Build the initial causal chain link for the affected resource.
   */
  buildInitialLink(resource: string, incidentType: IncidentType): CausalChainLink {
    return {
      entity: resource,
      entityType: 'table',
      issue: `${incidentType.replace(/_/g, ' ')} detected on ${resource}`,
      confidence: 0.95,
      timestamp: Date.now(),
    };
  }

  /**
   * Build causal chain links from upstream graph traversal results.
   */
  buildUpstreamLinks(incidentType: IncidentType, upstream: UpstreamEntry[]): CausalChainLink[] {
    return upstream.map((entry) => {
      const confidence = 0.95 * Math.pow(0.9, entry.depth); // 0.9 decay per hop
      return {
        entity: entry.node.name,
        entityType: this.mapNodeType(entry.node.type),
        issue: this.buildIssueDescription(incidentType, entry.node.name, entry.depth, entry.relationship),
        confidence,
        timestamp: Date.now() - entry.depth * 60_000, // Approximate timing
      };
    });
  }

  /**
   * Identify the root cause from the causal chain and similar past incidents.
   */
  identifyRootCause(
    type: IncidentType,
    chain: CausalChainLink[],
    similarIncidents: SimilarIncident[],
  ): string {
    if (chain.length === 0) return 'Unable to determine root cause';
    const deepest = chain[chain.length - 1];
    let rootCause = `${type.replace(/_/g, ' ')}: ${deepest.issue} (entity: ${deepest.entity})`;

    if (similarIncidents.length > 0 && similarIncidents[0].score > 0.3) {
      const similar = similarIncidents[0];
      const resolution = similar.metadata.resolution as string;
      rootCause += `. Similar to past incident ${similar.id} (resolved via ${resolution})`;
    }

    return rootCause;
  }

  /**
   * Calculate overall RCA confidence from the causal chain.
   */
  calculateConfidence(chain: CausalChainLink[]): number {
    if (chain.length === 0) return 0.5;
    return chain.reduce((acc, link) => acc * link.confidence, 1);
  }

  /**
   * Map graph node type to causal chain entity type.
   */
  private mapNodeType(graphType: string): CausalChainLink['entityType'] {
    switch (graphType) {
      case 'source': return 'table';
      case 'model': return 'table';
      case 'table': return 'table';
      case 'pipeline': return 'pipeline';
      case 'dashboard': return 'table';
      case 'view': return 'table';
      default: return 'table';
    }
  }

  /**
   * Build a human-readable issue description for a causal chain link.
   */
  private buildIssueDescription(type: IncidentType, entityName: string, _depth: number, relationship: string): string {
    const descriptions: Record<IncidentType, (name: string) => string> = {
      schema_change: (name) => `Upstream schema change propagated from ${name}`,
      source_delay: (name) => `Data delivery delay originating at ${name}`,
      resource_exhaustion: (name) => `Resource contention traced to ${name}`,
      code_regression: (name) => `Code change in ${name} caused downstream failures`,
      infrastructure: (name) => `Infrastructure issue at ${name} (${relationship})`,
      quality_degradation: (name) => `Data quality degradation originating from ${name}`,
    };
    return descriptions[type](entityName);
  }
}
