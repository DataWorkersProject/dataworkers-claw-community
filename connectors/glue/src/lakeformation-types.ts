/**
 * Type definitions for AWS Lake Formation operations.
 */

export interface LFPermission {
  principal: string;
  resource: string;
  permissions: string[];
  grantable: boolean;
}

export interface LFTag {
  tagKey: string;
  tagValues: string[];
}

export interface LFDataLakeSettings {
  admins: string[];
  createDatabaseDefaultPermissions: string[];
  createTableDefaultPermissions: string[];
}

/**
 * Interface that both stub and real Lake Formation clients implement.
 */
export interface ILakeFormationClient {
  seed(): void;
  getPermissions(resource: string): LFPermission[] | Promise<LFPermission[]>;
  getTags(resource: string): LFTag[] | Promise<LFTag[]>;
  getLakeFormationSettings(): LFDataLakeSettings | Promise<LFDataLakeSettings>;
  searchByTags(tags: string[]): string[] | Promise<string[]>;
}
