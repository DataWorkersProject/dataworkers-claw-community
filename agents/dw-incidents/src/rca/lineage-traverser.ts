/**
 * Lineage Graph Traverser for RCA (REQ-INC-002).
 *
 * Traverses the lineage graph upstream to identify the root cause
 * of an incident. Supports 5+ hop depth with confidence decay.
 *
 * @deprecated Use graphDB.traverseUpstream() directly via backends.ts.
 * This class uses simulateUpstreamPath() which generates fake data.
 * Kept for backward compatibility — will be removed in Phase 5.
 */

export interface LineageNode {
  id: string;
  name: string;
  type: 'table' | 'column' | 'pipeline' | 'view' | 'model' | 'dashboard';
  metadata: Record<string, unknown>;
}

export interface LineageEdge {
  sourceId: string;
  targetId: string;
  relationship: 'derives_from' | 'consumed_by' | 'transforms' | 'depends_on';
}

export interface TraversalResult {
  path: LineageNode[];
  edges: LineageEdge[];
  depth: number;
  impactRadius: number;
  confidenceAtDepth: number[];
  traversalTimeMs: number;
}

export class LineageTraverser {
  /** Confidence decays by this factor per hop */
  private confidenceDecayRate: number;
  private maxDepth: number;

  constructor(maxDepth = 10, confidenceDecayRate = 0.9) {
    this.maxDepth = maxDepth;
    this.confidenceDecayRate = confidenceDecayRate;
  }

  /**
   * Traverse upstream from an affected entity to find the root cause.
   * Returns the path with confidence scores at each depth.
   */
  async traverseUpstream(
    customerId: string,
    entityId: string,
    maxHops = 5,
  ): Promise<TraversalResult> {
    const start = Date.now();
    const effectiveMax = Math.min(maxHops, this.maxDepth);

    // In production: execute Cypher query against Neo4j
    // MATCH path = (start {id: entityId, customerId})-[:derives_from*1..maxHops]->(upstream)
    // WHERE ALL(n IN nodes(path) WHERE n.customerId = $customerId)
    // RETURN path

    const path = this.simulateUpstreamPath(entityId, effectiveMax);
    const confidenceAtDepth = path.map((_, i) =>
      Math.pow(this.confidenceDecayRate, i),
    );

    void customerId;

    return {
      path,
      edges: this.buildEdges(path),
      depth: path.length - 1,
      impactRadius: path.length,
      confidenceAtDepth,
      traversalTimeMs: Date.now() - start,
    };
  }

  /**
   * Traverse downstream to assess incident impact.
   */
  async traverseDownstream(
    customerId: string,
    entityId: string,
    maxHops = 5,
  ): Promise<TraversalResult> {
    const start = Date.now();
    const path = this.simulateDownstreamPath(entityId, Math.min(maxHops, this.maxDepth));

    void customerId;

    return {
      path,
      edges: this.buildEdges(path),
      depth: path.length - 1,
      impactRadius: path.length,
      confidenceAtDepth: path.map((_, i) => Math.pow(this.confidenceDecayRate, i)),
      traversalTimeMs: Date.now() - start,
    };
  }

  /**
   * Get the full impact analysis: upstream root + downstream blast radius.
   */
  async getImpactAnalysis(
    customerId: string,
    entityId: string,
    maxHops = 5,
  ): Promise<{ upstream: TraversalResult; downstream: TraversalResult; totalImpact: number }> {
    const [upstream, downstream] = await Promise.all([
      this.traverseUpstream(customerId, entityId, maxHops),
      this.traverseDownstream(customerId, entityId, maxHops),
    ]);

    return {
      upstream,
      downstream,
      totalImpact: upstream.impactRadius + downstream.impactRadius - 1,
    };
  }

  private simulateUpstreamPath(entityId: string, maxHops: number): LineageNode[] {
    const path: LineageNode[] = [{ id: entityId, name: entityId, type: 'table', metadata: {} }];
    for (let i = 1; i <= maxHops; i++) {
      path.push({
        id: `upstream_${i}`,
        name: `upstream_entity_${i}`,
        type: i % 2 === 0 ? 'pipeline' : 'table',
        metadata: { depth: i },
      });
    }
    return path;
  }

  private simulateDownstreamPath(entityId: string, maxHops: number): LineageNode[] {
    const path: LineageNode[] = [{ id: entityId, name: entityId, type: 'table', metadata: {} }];
    for (let i = 1; i <= maxHops; i++) {
      path.push({
        id: `downstream_${i}`,
        name: `downstream_entity_${i}`,
        type: i % 2 === 0 ? 'dashboard' : 'view',
        metadata: { depth: i },
      });
    }
    return path;
  }

  private buildEdges(path: LineageNode[]): LineageEdge[] {
    const edges: LineageEdge[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      edges.push({
        sourceId: path[i].id,
        targetId: path[i + 1].id,
        relationship: 'derives_from',
      });
    }
    return edges;
  }
}
