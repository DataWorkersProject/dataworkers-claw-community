import type { ToolDefinition, ToolHandler } from '@data-workers/mcp-framework';
import type { RootCauseAnalysis, CausalChainLink, IncidentType } from '../types.js';
import { graphDB, vectorStore, relationalStore, messageBus, getHistoryMatcher } from '../backends.js';
import { RootCauseEngine } from '../engine/root-cause.js';
import { startSpan } from '../tracing.js';

const rootCauseEngine = new RootCauseEngine();

export const getRootCauseDefinition: ToolDefinition = {
  name: 'get_root_cause',
  description: 'Perform root cause analysis for a diagnosed incident. Traverses the lineage graph up to 5+ hops upstream, queries execution logs, cross-references incident history, and returns a causal chain with confidence scores.',
  inputSchema: {
    type: 'object',
    properties: {
      incidentId: { type: 'string', description: 'ID of the diagnosed incident.' },
      incidentType: { type: 'string', enum: ['schema_change', 'source_delay', 'resource_exhaustion', 'code_regression', 'infrastructure', 'quality_degradation'] },
      affectedResources: { type: 'array', items: { type: 'string' }, description: 'Resources affected by the incident.' },
      customerId: { type: 'string' },
      maxDepth: { type: 'number', description: 'Max lineage traversal depth. Default: 5.' },
    },
    required: ['incidentId', 'incidentType', 'affectedResources', 'customerId'],
  },
};

export const getRootCauseHandler: ToolHandler = async (args) => {
  const incidentId = args.incidentId as string;
  const incidentType = args.incidentType as IncidentType;
  const affectedResources = args.affectedResources as string[];
  const maxDepth = (args.maxDepth as number) ?? 5;
  const customerId = args.customerId as string;
  const start = Date.now();
  const span = startSpan('incident.getRootCause', { customerId, incidentId, resourceCount: affectedResources.length });

  // Fan out multiple investigation paths simultaneously
  const [lineageResults, historicalResults, qualityResults] = await Promise.allSettled([
    // Path 1: Lineage graph traversal
    (async () => {
      const chains: CausalChainLink[] = [];
      const resources: string[] = [];
      for (const resource of affectedResources) {
        chains.push(rootCauseEngine.buildInitialLink(resource, incidentType));
        resources.push(resource);
        const allMatches = await graphDB.findByName(resource, customerId);
        const exactMatches = allMatches.filter((n) => n.name.toLowerCase() === resource.toLowerCase());
        const matchingNodes = exactMatches.length > 0 ? exactMatches : allMatches;
        if (matchingNodes.length > 0) {
          const upstream = await graphDB.traverseUpstream(matchingNodes[0].id, maxDepth);
          chains.push(...rootCauseEngine.buildUpstreamLinks(incidentType, upstream));
        }
      }
      return { source: 'lineage_graph' as const, chains, resources };
    })(),

    // Path 2: Historical pattern matching (vector + history matcher)
    (async () => {
      const desc = `${incidentType.replace(/_/g, ' ')} incident affecting ${affectedResources.join(', ')}`;
      const vec = await vectorStore.embed(desc);
      const similar = await vectorStore.query(vec, 3, 'incidents', (m) => m.customerId === customerId);
      const matcher = getHistoryMatcher();
      const matchResults = await matcher.findSimilar(incidentType, affectedResources, customerId, 3);
      return { source: 'incident_history' as const, similar, matchResults };
    })(),

    // Path 3: Quality context (cross-agent, may timeout)
    (async () => {
      const ctx = await messageBus.request('get_quality_context', { resources: affectedResources, customerId }, 2000);
      return { source: 'quality_context' as const, context: ctx };
    })().catch(() => ({ source: 'quality_context' as const, context: null as Record<string, unknown> | null })),
  ]);

  // Merge results from all paths
  const allCausalChains: CausalChainLink[] = lineageResults.status === 'fulfilled' ? lineageResults.value.chains : [];
  const processedResources: string[] = lineageResults.status === 'fulfilled' ? lineageResults.value.resources : [...affectedResources];
  const similarIncidents = historicalResults.status === 'fulfilled' ? historicalResults.value.similar : [];
  const matchResults = historicalResults.status === 'fulfilled' ? historicalResults.value.matchResults : [];
  const qualityContext = qualityResults.status === 'fulfilled' ? qualityResults.value.context : null;

  // Build evidence from investigation results
  const evidence: Array<{ source: string; finding: string; weight: number }> = [];

  if (lineageResults.status === 'fulfilled') {
    const chains = lineageResults.value.chains;
    if (chains.length > 1) {
      evidence.push({
        source: 'lineage_graph',
        finding: `Traced ${chains.length} entities in causal chain from ${affectedResources.join(', ')}`,
        weight: 0.4,
      });
    }
  }

  if (historicalResults.status === 'fulfilled' && historicalResults.value.similar.length > 0) {
    evidence.push({
      source: 'incident_history',
      finding: `Found ${historicalResults.value.similar.length} similar past incidents`,
      weight: 0.3,
    });
  }

  if (qualityResults.status === 'fulfilled' && qualityResults.value.context) {
    evidence.push({
      source: 'quality_context',
      finding: 'Quality context enrichment available from dw-quality agent',
      weight: 0.2,
    });
  }

  // Determine root cause from the deepest node in the chain via engine
  const rootCause = rootCauseEngine.identifyRootCause(incidentType, allCausalChains, similarIncidents);
  const confidence = rootCauseEngine.calculateConfidence(allCausalChains);

  const rca: RootCauseAnalysis = {
    incidentId,
    rootCause,
    causalChain: allCausalChains,
    confidence,
    evidenceSources: [
      'lineage_graph',
      ...(similarIncidents.length > 0 ? ['incident_history'] : []),
      ...(matchResults.length > 0 ? ['history_matcher'] : []),
      ...(qualityContext ? ['quality_context'] : []),
    ],
    processedResources,
    traversalDepth: Math.min(maxDepth, Math.max(0, allCausalChains.length - 1)),
    analysisTimeMs: Date.now() - start,
    evidence: evidence.length > 0 ? evidence : undefined,
  };

  // Update incident record in relational store with RCA results.
  // NOTE: IRelationalStore has no update() method yet, so we mutate the
  // queried row objects directly (works for InMemory; real adapters will
  // need an update() method added to the interface).
  try {
    const incidents = await relationalStore.query('incidents', (row) => row.id === incidentId);
    if (incidents.length > 0) {
      const incident = incidents[0];
      incident.rootCause = JSON.stringify(rca);
      incident.status = 'diagnosed';
    }
  } catch { /* Don't crash RCA on store update failure */ }

  span.setStatus('ok');
  span.end();

  return {
    content: [{ type: 'text', text: JSON.stringify(rca, null, 2) }],
  };
};

