import type { Incident, RootCauseAnalysis } from '../types.js';

/**
 * Novel Incident Reporter (REQ-INC-004).
 *
 * For incidents that don't match known patterns or have low confidence,
 * generates a structured diagnosis report with recommendations
 * and routes to human approval.
 */

export interface DiagnosisReport {
  incidentId: string;
  title: string;
  summary: string;
  rootCauseHypothesis: string;
  confidence: number;
  evidenceChain: string[];
  recommendedActions: RecommendedAction[];
  estimatedImpact: string;
  urgency: 'immediate' | 'high' | 'medium' | 'low';
  generatedAt: number;
  requiresApproval: boolean;
  approvalRouting: ApprovalRouting;
}

export interface RecommendedAction {
  action: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  estimatedDuration: string;
  requiresApproval: boolean;
}

export interface ApprovalRouting {
  channel: 'slack' | 'email' | 'jira' | 'pagerduty';
  priority: 'p1' | 'p2' | 'p3';
  assignTo?: string;
  escalateAfterMs: number;
}

export class NovelIncidentReporter {
  /**
   * Generate a structured diagnosis report for a novel incident.
   */
  generateReport(
    incident: Partial<Incident>,
    rca: RootCauseAnalysis,
  ): DiagnosisReport {
    const urgency = this.assessUrgency(incident, rca);
    const recommendations = this.generateRecommendations(incident, rca);

    return {
      incidentId: incident.id ?? 'unknown',
      title: incident.title ?? `Novel ${incident.type ?? 'unknown'} incident`,
      summary: this.generateSummary(incident, rca),
      rootCauseHypothesis: rca.rootCause,
      confidence: rca.confidence,
      evidenceChain: rca.causalChain.map(
        (link) => `${link.entity} (${link.entityType}): ${link.issue} [conf: ${(link.confidence * 100).toFixed(0)}%]`,
      ),
      recommendedActions: recommendations,
      estimatedImpact: this.assessImpact(incident),
      urgency,
      generatedAt: Date.now(),
      requiresApproval: true,
      approvalRouting: {
        channel: urgency === 'immediate' ? 'pagerduty' : 'slack',
        priority: urgency === 'immediate' ? 'p1' : urgency === 'high' ? 'p2' : 'p3',
        escalateAfterMs: urgency === 'immediate' ? 900_000 : 3_600_000, // 15min or 1hr
      },
    };
  }

  private generateSummary(incident: Partial<Incident>, rca: RootCauseAnalysis): string {
    return [
      `Novel incident detected on ${incident.affectedResources?.join(', ') ?? 'unknown resources'}.`,
      `Type: ${incident.type ?? 'unknown'}. Severity: ${incident.severity ?? 'unknown'}.`,
      `Root cause hypothesis (${(rca.confidence * 100).toFixed(0)}% confidence): ${rca.rootCause}`,
      `Causal chain depth: ${rca.causalChain.length} entities.`,
      `Evidence sources: ${rca.evidenceSources.join(', ')}.`,
      `This incident does not match known remediation patterns. Human review required.`,
    ].join(' ');
  }

  private generateRecommendations(
    incident: Partial<Incident>,
    rca: RootCauseAnalysis,
  ): RecommendedAction[] {
    const actions: RecommendedAction[] = [];

    // Always recommend investigation
    actions.push({
      action: 'investigate_root_cause',
      description: `Investigate: ${rca.rootCause}`,
      risk: 'low',
      estimatedDuration: '30-60 minutes',
      requiresApproval: false,
    });

    // Type-specific recommendations
    switch (incident.type) {
      case 'schema_change':
        actions.push({
          action: 'review_schema_changes',
          description: 'Review recent schema changes and assess downstream impact',
          risk: 'low',
          estimatedDuration: '15-30 minutes',
          requiresApproval: false,
        });
        break;
      case 'code_regression':
        actions.push({
          action: 'review_recent_deploys',
          description: 'Review recent deployments and consider rollback',
          risk: 'medium',
          estimatedDuration: '15-30 minutes',
          requiresApproval: true,
        });
        break;
      case 'resource_exhaustion':
        actions.push({
          action: 'manual_scale',
          description: 'Manually scale compute resources after reviewing usage patterns',
          risk: 'medium',
          estimatedDuration: '10-20 minutes',
          requiresApproval: true,
        });
        break;
      default:
        actions.push({
          action: 'manual_investigation',
          description: 'Perform manual investigation of affected resources',
          risk: 'low',
          estimatedDuration: '30-60 minutes',
          requiresApproval: false,
        });
    }

    return actions;
  }

  private assessUrgency(incident: Partial<Incident>, _rca: RootCauseAnalysis): DiagnosisReport['urgency'] {
    if (incident.severity === 'critical') return 'immediate';
    if (incident.severity === 'high') return 'high';
    if (incident.severity === 'medium') return 'medium';
    return 'low';
  }

  private assessImpact(incident: Partial<Incident>): string {
    const resources = incident.affectedResources?.length ?? 0;
    if (resources > 10) return 'High: 10+ resources affected';
    if (resources > 3) return `Medium: ${resources} resources affected`;
    return `Low: ${resources} resource(s) affected`;
  }
}
