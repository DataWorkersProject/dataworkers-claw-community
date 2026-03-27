/**
 * Stubbed AWS Lake Formation client.
 * Uses in-memory stores to simulate Lake Formation APIs.
 */

import type {
  ILakeFormationClient,
  LFPermission,
  LFTag,
  LFDataLakeSettings,
} from './lakeformation-types.js';

export class LakeFormationStubClient implements ILakeFormationClient {
  private permissions: Map<string, LFPermission[]> = new Map();
  private tags: Map<string, LFTag[]> = new Map();
  private settings: LFDataLakeSettings | null = null;
  private resourceTags: Map<string, string[]> = new Map();
  private seeded = false;

  /** Pre-load with realistic Lake Formation metadata. */
  seed(): void {
    if (this.seeded) return;

    // --- Permissions ---
    this.permissions.set('analytics_db', [
      { principal: 'arn:aws:iam::123456789012:role/DataAnalyst', resource: 'analytics_db', permissions: ['SELECT', 'DESCRIBE'], grantable: false },
      { principal: 'arn:aws:iam::123456789012:role/DataEngineer', resource: 'analytics_db', permissions: ['ALL'], grantable: true },
    ]);
    this.permissions.set('analytics_db.user_events', [
      { principal: 'arn:aws:iam::123456789012:role/DataAnalyst', resource: 'analytics_db.user_events', permissions: ['SELECT'], grantable: false },
      { principal: 'arn:aws:iam::123456789012:role/DataEngineer', resource: 'analytics_db.user_events', permissions: ['ALL'], grantable: true },
    ]);
    this.permissions.set('raw_data_db', [
      { principal: 'arn:aws:iam::123456789012:role/DataLoader', resource: 'raw_data_db', permissions: ['CREATE_TABLE', 'ALTER', 'DROP'], grantable: false },
      { principal: 'arn:aws:iam::123456789012:role/Admin', resource: 'raw_data_db', permissions: ['ALL'], grantable: true },
    ]);

    // --- LF Tags ---
    this.tags.set('analytics_db', [
      { tagKey: 'classification', tagValues: ['internal'] },
      { tagKey: 'team', tagValues: ['analytics'] },
    ]);
    this.tags.set('analytics_db.user_events', [
      { tagKey: 'classification', tagValues: ['confidential'] },
      { tagKey: 'pii', tagValues: ['true'] },
      { tagKey: 'team', tagValues: ['analytics', 'marketing'] },
    ]);
    this.tags.set('raw_data_db', [
      { tagKey: 'classification', tagValues: ['restricted'] },
      { tagKey: 'team', tagValues: ['data-engineering'] },
    ]);

    // --- Resource-tag index for search ---
    this.resourceTags.set('confidential', ['analytics_db.user_events']);
    this.resourceTags.set('internal', ['analytics_db']);
    this.resourceTags.set('restricted', ['raw_data_db']);
    this.resourceTags.set('pii', ['analytics_db.user_events']);
    this.resourceTags.set('analytics', ['analytics_db', 'analytics_db.user_events']);
    this.resourceTags.set('marketing', ['analytics_db.user_events']);
    this.resourceTags.set('data-engineering', ['raw_data_db']);

    // --- Data Lake Settings ---
    this.settings = {
      admins: ['arn:aws:iam::123456789012:role/LakeFormationAdmin', 'arn:aws:iam::123456789012:role/Admin'],
      createDatabaseDefaultPermissions: ['ALL'],
      createTableDefaultPermissions: ['ALL'],
    };

    this.seeded = true;
  }

  /** Get permissions for a resource. */
  getPermissions(resource: string): LFPermission[] {
    return this.permissions.get(resource) ?? [];
  }

  /** Get LF tags for a resource. */
  getTags(resource: string): LFTag[] {
    return this.tags.get(resource) ?? [];
  }

  /** Get Lake Formation data lake settings. */
  getLakeFormationSettings(): LFDataLakeSettings {
    if (!this.settings) {
      throw new Error('Lake Formation not initialized. Call seed() first.');
    }
    return this.settings;
  }

  /** Search for resources by tag values. */
  searchByTags(tags: string[]): string[] {
    const resultSet = new Set<string>();
    for (const tag of tags) {
      const resources = this.resourceTags.get(tag.toLowerCase());
      if (resources) {
        for (const r of resources) {
          resultSet.add(r);
        }
      }
    }
    return Array.from(resultSet);
  }
}
