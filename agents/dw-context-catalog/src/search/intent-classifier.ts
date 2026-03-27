/**
 * IntentClassifier — regex-first NL query classification (<10ms).
 * Maps user queries to the most appropriate MCP tool.
 */

export type SearchIntent =
  | 'find_assets'
  | 'get_lineage'
  | 'resolve_metric'
  | 'get_documentation'
  | 'check_freshness'
  | 'explain_table'
  | 'correlate_metadata'
  | 'detect_dead_assets'
  | 'blast_radius'
  | 'cross_platform_lineage'
  | 'explore';

export interface ClassificationResult {
  intent: SearchIntent;
  confidence: number;
  extractedEntities: {
    assetName?: string;
    metricName?: string;
    domain?: string;
  };
  /** Ranked list of all matching intents (primary intent first). */
  allIntents?: Array<{ intent: SearchIntent; confidence: number }>;
}

interface IntentPattern {
  intent: SearchIntent;
  patterns: RegExp[];
  confidence: number;
}

const DOMAIN_KEYWORDS = ['finance', 'product', 'marketing', 'engineering', 'sales', 'analytics'];

export class IntentClassifier {
  private intentPatterns: IntentPattern[] = [
    {
      intent: 'get_lineage',
      patterns: [
        /\blineage\s+(of|for)\s+/i,
        /\bwhat\s+feeds?\s+/i,
        /\bupstream\b/i,
        /\bdownstream\b/i,
        /\bderived?\s+from\b/i,
        /\bdepends?\s+on\b/i,
        /\bdependenc(y|ies)\s+(of|for)\b/i,
        /\bprovenance\b/i,
        /\bwhere\s+does?\s+.*\s+come\s+from\b/i,
        /\bwhat\s+(uses?|consumes?)\s+/i,
        /\bsource(s)?\s+(of|for)\b/i,
        /\bimpact\s+(of|on|analysis)\b/i,
      ],
      confidence: 0.92,
    },
    {
      intent: 'resolve_metric',
      patterns: [
        /\bwhat\s+is\s+(the\s+)?(\w+)\s+metric\b/i,
        /\bdefine\s+/i,
        /\bhow\s+is\s+(\w+)\s+calculated\b/i,
        /\bmetric\s+(definition|formula)\b/i,
        /\bresolve\s+(metric|definition)\b/i,
        /\bcanonical\s+(name|definition)\b/i,
        /\bwhat\s+does?\s+(\w+)\s+mean\b/i,
        /\bformula\s+(for|of)\b/i,
        /\bkpi\s+(definition|meaning)\b/i,
      ],
      confidence: 0.90,
    },
    {
      intent: 'get_documentation',
      patterns: [
        /\bdocument(ation)?\s+(for|of|about)\b/i,
        /\bdescribe\s+/i,
        /\bwhat\s+columns?\s+(does|are|in)\b/i,
        /\bschema\s+(of|for)\b/i,
        /\btell\s+me\s+about\s+/i,
        /\bexplain\s+/i,
        /\bcolumn(s)?\s+(in|of|for)\b/i,
        /\bwhat\s+data\s+(is|does)\s+(in|contain)\b/i,
        /\bgenerate\s+doc(s|umentation)?\b/i,
      ],
      confidence: 0.88,
    },
    {
      intent: 'check_freshness',
      patterns: [
        /\bhow\s+fresh\b/i,
        /\bwhen\s+was\b.*\bupdated\b/i,
        /\bwhen\s+(was\s+)?(last\s+)?updated\b/i,
        /\bstale(ness)?\b/i,
        /\bsla\b/i,
        /\bfreshness\b/i,
        /\blast\s+refresh(ed)?\b/i,
        /\bdata\s+age\b/i,
        /\bhow\s+old\b/i,
        /\blag(ging)?\b/i,
        /\blatency\b/i,
        /\bout\s+of\s+date\b/i,
      ],
      confidence: 0.91,
    },
    {
      intent: 'explain_table',
      patterns: [
        /\bexplain\s+table\b/i,
        /\btable\s+explanation\b/i,
        /\bwhat\s+is\s+(?:the\s+)?(?:purpose|role)\s+of\s+(?:the\s+)?(\w[\w_.]*)\s+table\b/i,
        /\bsummar(?:y|ize)\s+(?:the\s+)?(\w[\w_.]*)\s+table\b/i,
        /\bexplain\s+(\w[\w_.]*)\s+table\b/i,
      ],
      confidence: 0.89,
    },
    {
      intent: 'correlate_metadata',
      patterns: [
        /\bcorrelat(e|ion)\s+/i,
        /\bmetadata\s+overlap\b/i,
        /\bsimilar\s+(tables?|assets?|datasets?)\b/i,
        /\brelated\s+(tables?|assets?|datasets?)\b/i,
        /\boverlap(ping)?\s+(columns?|schema|fields?)\b/i,
        /\bcompare\s+(schemas?|metadata)\b/i,
      ],
      confidence: 0.87,
    },
    {
      intent: 'detect_dead_assets',
      patterns: [
        /\bdead\s+(assets?|tables?|datasets?)\b/i,
        /\bunused\s+(assets?|tables?|datasets?|models?)\b/i,
        /\borphan(ed)?\s+(assets?|tables?|datasets?)\b/i,
        /\bstale\s+(assets?|tables?|datasets?)\b/i,
        /\bdeprecated\s+(assets?|tables?)\b/i,
        /\bno\s+consumers?\b/i,
        /\bzero\s+(usage|queries)\b/i,
      ],
      confidence: 0.88,
    },
    {
      intent: 'blast_radius',
      patterns: [
        /\bblast\s+radius\b/i,
        /\bimpact\s+(analysis|assessment|scope)\b/i,
        /\bwhat\s+breaks?\s+if\b/i,
        /\baffected\s+(assets?|tables?|pipelines?|dashboards?)\b/i,
        /\bchange\s+impact\b/i,
        /\bripple\s+effect\b/i,
      ],
      confidence: 0.90,
    },
    {
      intent: 'cross_platform_lineage',
      patterns: [
        /\bcross[\s-]platform\s+lineage\b/i,
        /\blineage\s+across\s+(platforms?|systems?|tools?)\b/i,
        /\bend[\s-]to[\s-]end\s+lineage\b/i,
        /\bfull\s+lineage\b/i,
        /\blineage\s+from\s+(\w+)\s+to\s+(\w+)\b/i,
        /\btraces?\s+across\b/i,
      ],
      confidence: 0.91,
    },
    {
      intent: 'find_assets',
      patterns: [
        /\bfind\s+/i,
        /\bsearch\s+(for\s+)?/i,
        /\bshow\s+me\s+/i,
        /\blist\s+/i,
        /\blook\s*(up|for)\s+/i,
        /\bwhere\s+is\b/i,
        /\bwhich\s+(table|dataset|model|pipeline|dashboard)s?\b/i,
        /\bget\s+(all|the)\s+/i,
      ],
      confidence: 0.85,
    },
  ];

  /**
   * Classify a query into an intent. Regex-first for speed (<10ms).
   * Returns the top-ranked intent plus an `allIntents` array of every match.
   */
  classify(query: string): ClassificationResult {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return {
        intent: 'explore',
        confidence: 0.5,
        extractedEntities: {},
        allIntents: [{ intent: 'explore', confidence: 0.5 }],
      };
    }

    // Collect all matching intents
    const matches: Array<{ intent: SearchIntent; confidence: number }> = [];

    for (const { intent, patterns, confidence } of this.intentPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedQuery)) {
          matches.push({ intent, confidence });
          break; // one match per intent group is enough
        }
      }
    }

    if (matches.length === 0) {
      return {
        intent: 'explore',
        confidence: 0.5,
        extractedEntities: this.extractEntities(normalizedQuery, 'explore'),
        allIntents: [{ intent: 'explore', confidence: 0.5 }],
      };
    }

    // Sort by confidence descending
    matches.sort((a, b) => b.confidence - a.confidence);

    const primary = matches[0];
    return {
      intent: primary.intent,
      confidence: primary.confidence,
      extractedEntities: this.extractEntities(normalizedQuery, primary.intent),
      allIntents: matches,
    };
  }

  /**
   * Extract structured entities from the query based on the classified intent.
   */
  private extractEntities(
    query: string,
    intent: SearchIntent,
  ): { assetName?: string; metricName?: string; domain?: string } {
    const entities: { assetName?: string; metricName?: string; domain?: string } = {};

    // Extract domain
    for (const domain of DOMAIN_KEYWORDS) {
      if (query.includes(domain)) {
        entities.domain = domain;
        break;
      }
    }

    // Extract asset or metric name based on intent
    if (intent === 'resolve_metric') {
      // "what is the MRR metric" → MRR
      const metricMatch =
        query.match(/\bwhat\s+is\s+(?:the\s+)?(\w+)\s+metric\b/i) ||
        query.match(/\bdefine\s+(\w[\w_]*)/i) ||
        query.match(/\bhow\s+is\s+(\w[\w_]*)\s+calculated\b/i) ||
        query.match(/\bformula\s+(?:for|of)\s+(\w[\w_]*)/i);
      if (metricMatch) {
        entities.metricName = metricMatch[1];
      }
    } else if (intent === 'get_lineage' || intent === 'get_documentation' || intent === 'check_freshness') {
      // "lineage of orders" → orders
      const assetMatch =
        query.match(/(?:lineage|documentation|freshness|describe|document)\s+(?:of|for|about)\s+(\w[\w_.]*)/i) ||
        query.match(/\bwhat\s+feeds?\s+(\w[\w_.]*)/i) ||
        query.match(/\bupstream\s+(?:of\s+)?(\w[\w_.]*)/i) ||
        query.match(/\bdownstream\s+(?:of\s+)?(\w[\w_.]*)/i) ||
        query.match(/\bhow\s+fresh\s+(?:is\s+)?(\w[\w_.]*)/i) ||
        query.match(/\bwhen\s+(?:was\s+)?(\w[\w_.]*)\s+(?:last\s+)?updated/i) ||
        query.match(/\bdescribe\s+(\w[\w_.]*)/i) ||
        query.match(/\bcolumns?\s+(?:in|of|for)\s+(\w[\w_.]*)/i);
      if (assetMatch) {
        entities.assetName = assetMatch[1];
      }
    } else if (intent === 'find_assets') {
      const assetMatch =
        query.match(/(?:find|search|show\s+me|list|look\s*(?:up|for))\s+(?:for\s+)?(?:all\s+)?(\w[\w_. ]*\w)/i);
      if (assetMatch) {
        entities.assetName = assetMatch[1].trim();
      }
    } else if (intent === 'explain_table') {
      const tableMatch =
        query.match(/\bexplain\s+(?:table\s+)?(\w[\w_.]*)/i) ||
        query.match(/\bsummar(?:y|ize)\s+(?:the\s+)?(\w[\w_.]*)/i) ||
        query.match(/\bpurpose\s+of\s+(?:the\s+)?(\w[\w_.]*)/i);
      if (tableMatch) {
        entities.assetName = tableMatch[1];
      }
    } else if (intent === 'blast_radius' || intent === 'cross_platform_lineage') {
      const assetMatch =
        query.match(/\bblast\s+radius\s+(?:of|for)\s+(\w[\w_.]*)/i) ||
        query.match(/\bwhat\s+breaks?\s+if\s+(\w[\w_.]*)/i) ||
        query.match(/\bimpact\s+(?:of|on)\s+(\w[\w_.]*)/i) ||
        query.match(/\blineage\s+(?:of|for|across)\s+(\w[\w_.]*)/i);
      if (assetMatch) {
        entities.assetName = assetMatch[1];
      }
    } else if (intent === 'detect_dead_assets') {
      // No specific asset extraction needed — this is a discovery intent
    } else if (intent === 'correlate_metadata') {
      const assetMatch =
        query.match(/\bcorrelat(?:e|ion)\s+(?:of|for|with)?\s*(\w[\w_.]*)/i) ||
        query.match(/\bsimilar\s+(?:to\s+)?(\w[\w_.]*)/i);
      if (assetMatch) {
        entities.assetName = assetMatch[1];
      }
    }

    return entities;
  }
}
