import { httpApiClient } from "$lib/api/http";
import type { ApiClient } from "$lib/api/types";

/**
 * The active API client.
 * Now points to the real HTTP client.
 */
export const api: ApiClient = httpApiClient;

export type { ApiClient, AuthResult, CompanyEmployee, RoleDefinition, RoleName, Permission } from "$lib/api/types";
