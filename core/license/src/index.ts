export {
  type LicenseTier,
  type ToolCategory,
  type ToolGateResult,
  isToolAllowed,
  gateCheck,
  classifyTool,
  getCurrentTier,
  getWriteTools,
  getAdminTools,
  getWriteToolsByAgent,
  filterAllowedTools,
} from './tool-gate.js';

// OSS edition: license validation stubs
export interface LicensePayload {
  tier: 'community' | 'pro' | 'enterprise';
  customerId: string;
  expiresAt: string;
}

export interface ValidationResult {
  valid: boolean;
  tier: 'community' | 'pro' | 'enterprise';
  error?: string;
}

export function validateLicense(): ValidationResult {
  return { valid: false, tier: 'community', error: 'License validation not available in OSS edition' };
}

export function clearLicenseCache(): void {}
