/**
 * Regulatory compliance policy templates.
 *
 * Pre-built policy sets for GDPR, SOC 2, HIPAA, and PCI DSS.
 * Templates can be loaded into a PolicyStore for a given tenant.
 */

import type { GovernancePolicy, RegulatoryFramework, RegulatoryTemplate } from '../types.js';
import type { PolicyStore } from '../policy-store.js';

/** Generate a unique policy ID from framework + index. */
function templatePolicyId(framework: string, idx: number): string {
  return `pol-${framework.toLowerCase().replace(/_/g, '-')}-${idx}`;
}

/** GDPR compliance policy template. */
const GDPR_TEMPLATE: (customerId: string) => GovernancePolicy[] = (customerId) => [
  {
    id: templatePolicyId('gdpr', 1),
    customerId,
    name: 'gdpr_right_to_erasure',
    resource: '*customer*',
    action: 'allow',
    conditions: { actions: ['DELETE'] },
    priority: 95,
  },
  {
    id: templatePolicyId('gdpr', 2),
    customerId,
    name: 'gdpr_data_minimization',
    resource: '*pii*',
    action: 'review',
    conditions: { actions: ['WRITE', 'INSERT', 'UPDATE'] },
    priority: 90,
  },
  {
    id: templatePolicyId('gdpr', 3),
    customerId,
    name: 'gdpr_consent_required',
    resource: '*personal*',
    action: 'review',
    conditions: { actions: ['READ', 'SELECT', 'EXPORT'] },
    priority: 85,
  },
  {
    id: templatePolicyId('gdpr', 4),
    customerId,
    name: 'gdpr_cross_border_transfer',
    resource: '*',
    action: 'deny',
    conditions: { actions: ['TRANSFER', 'REPLICATE'] },
    priority: 92,
  },
];

/** SOC 2 compliance policy template. */
const SOC2_TEMPLATE: (customerId: string) => GovernancePolicy[] = (customerId) => [
  {
    id: templatePolicyId('soc2', 1),
    customerId,
    name: 'soc2_audit_trail',
    resource: '*audit*',
    action: 'review',
    conditions: { actions: ['*'] },
    priority: 85,
  },
  {
    id: templatePolicyId('soc2', 2),
    customerId,
    name: 'soc2_change_management',
    resource: '*',
    action: 'review',
    conditions: { actions: ['ALTER', 'CREATE', 'DROP'] },
    priority: 80,
  },
  {
    id: templatePolicyId('soc2', 3),
    customerId,
    name: 'soc2_access_control',
    resource: '*sensitive*',
    action: 'deny',
    conditions: { actions: ['*'] },
    priority: 88,
  },
];

/** HIPAA compliance policy template. */
const HIPAA_TEMPLATE: (customerId: string) => GovernancePolicy[] = (customerId) => [
  {
    id: templatePolicyId('hipaa', 1),
    customerId,
    name: 'hipaa_phi_access',
    resource: '*medical*',
    action: 'review',
    conditions: { actions: ['READ', 'WRITE', 'SELECT'] },
    priority: 90,
  },
  {
    id: templatePolicyId('hipaa', 2),
    customerId,
    name: 'hipaa_minimum_necessary',
    resource: '*patient*',
    action: 'review',
    conditions: { actions: ['*'] },
    priority: 88,
  },
  {
    id: templatePolicyId('hipaa', 3),
    customerId,
    name: 'hipaa_breach_notification',
    resource: '*health*',
    action: 'deny',
    conditions: { actions: ['EXPORT', 'TRANSFER'] },
    priority: 95,
  },
];

/** PCI DSS compliance policy template. */
const PCI_DSS_TEMPLATE: (customerId: string) => GovernancePolicy[] = (customerId) => [
  {
    id: templatePolicyId('pci-dss', 1),
    customerId,
    name: 'pci_card_data_masking',
    resource: '*credit_card*',
    action: 'deny',
    conditions: { actions: ['SELECT', 'READ'] },
    priority: 95,
  },
  {
    id: templatePolicyId('pci-dss', 2),
    customerId,
    name: 'pci_cardholder_encryption',
    resource: '*card*',
    action: 'review',
    conditions: { actions: ['WRITE', 'INSERT', 'UPDATE'] },
    priority: 90,
  },
  {
    id: templatePolicyId('pci-dss', 3),
    customerId,
    name: 'pci_network_segmentation',
    resource: '*payment*',
    action: 'deny',
    conditions: { actions: ['TRANSFER', 'REPLICATE'] },
    priority: 92,
  },
];

/** Map of framework to template generator. */
const TEMPLATE_MAP: Record<RegulatoryFramework, (customerId: string) => GovernancePolicy[]> = {
  GDPR: GDPR_TEMPLATE,
  SOC2: SOC2_TEMPLATE,
  HIPAA: HIPAA_TEMPLATE,
  PCI_DSS: PCI_DSS_TEMPLATE,
};

/** Template descriptions. */
const TEMPLATE_DESCRIPTIONS: Record<RegulatoryFramework, { name: string; description: string }> = {
  GDPR: {
    name: 'General Data Protection Regulation (GDPR)',
    description: 'EU data protection: right to erasure, data minimization, consent, cross-border transfer controls.',
  },
  SOC2: {
    name: 'SOC 2 Type II',
    description: 'Service organization controls: audit trail, change management, access control for sensitive data.',
  },
  HIPAA: {
    name: 'Health Insurance Portability and Accountability Act (HIPAA)',
    description: 'Protected health information: PHI access control, minimum necessary rule, breach notification.',
  },
  PCI_DSS: {
    name: 'Payment Card Industry Data Security Standard (PCI DSS)',
    description: 'Cardholder data protection: card data masking, encryption requirements, network segmentation.',
  },
};

/**
 * Get a regulatory template with its policies pre-generated for a customer.
 */
export function getRegulatoryTemplate(
  framework: RegulatoryFramework,
  customerId: string,
): RegulatoryTemplate {
  const generator = TEMPLATE_MAP[framework];
  const desc = TEMPLATE_DESCRIPTIONS[framework];
  return {
    framework,
    name: desc.name,
    description: desc.description,
    policies: generator(customerId),
  };
}

/**
 * List all available regulatory frameworks.
 */
export function listRegulatoryFrameworks(): RegulatoryFramework[] {
  return ['GDPR', 'SOC2', 'HIPAA', 'PCI_DSS'];
}

/**
 * Apply a regulatory template to a policy store for a given tenant.
 */
export async function applyRegulatoryTemplate(
  policyStore: PolicyStore,
  framework: RegulatoryFramework,
  customerId: string,
): Promise<{ applied: number; framework: RegulatoryFramework; policies: GovernancePolicy[] }> {
  const template = getRegulatoryTemplate(framework, customerId);
  for (const policy of template.policies) {
    await policyStore.addPolicy(policy);
  }
  return {
    applied: template.policies.length,
    framework,
    policies: template.policies,
  };
}
