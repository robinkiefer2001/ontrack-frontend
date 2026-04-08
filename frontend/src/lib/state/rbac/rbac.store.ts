import { writable, derived, get } from "svelte/store";
import { api, type CompanyEmployee, type Permission, type RoleDefinition, type RoleName } from "$lib/api";
import { currentUser } from "$lib/state/user/currentUser.store";

/** All RBAC role definitions loaded from the API. */
export const roles = writable<RoleDefinition[]>([]);

/** All company employees with their role. */
export const employees = writable<CompanyEmployee[]>([]);

/** Whether the initial data has been loaded. */
let initialised = false;

/** Fetch roles and employees from the API and populate stores. */
export async function loadRbac(): Promise<void> {
  const [r, e] = await Promise.all([api.getRoles(), api.getEmployees()]);
  roles.set(r);
  employees.set(e);
  initialised = true;
}

/** Ensure data is loaded (idempotent). */
export async function ensureRbac(): Promise<void> {
  if (!initialised) await loadRbac();
}

// ── Derived helpers ──────────────────────────────────────────────────────────

/** Role of the current user. */
export const currentRole = derived(
  [currentUser, employees],
  ([$currentUser, $employees]) => {
    const emp = $employees.find((e) => e.employeeID === $currentUser.employeeID);
    return emp?.role ?? ("Viewer" as RoleName);
  },
);

/** Permission set for the current user's role. */
export const currentPermissions = derived(
  [currentRole, roles],
  ([$currentRole, $roles]) => {
    const role = $roles.find((r) => r.name === $currentRole);
    return new Set<Permission>(role?.permissions ?? []);
  },
);

/** Check whether the current user has a specific permission. */
export function hasPermission(permission: Permission): boolean {
  return get(currentPermissions).has(permission);
}

/** Reactive derived store: does the current user have the given permission? */
export function watchPermission(permission: Permission) {
  return derived(currentPermissions, ($perms) => $perms.has(permission));
}

// ── Mutation helpers (delegate to API, then refresh stores) ──────────────────

export async function updateRole(role: RoleDefinition): Promise<void> {
  await api.updateRole(role);
  roles.update((all) => all.map((r) => (r.name === role.name ? role : r)));
}

export async function addEmployee(data: Omit<CompanyEmployee, "employeeID">): Promise<CompanyEmployee> {
  const created = await api.addEmployee(data);
  employees.update((all) => [...all, created]);
  return created;
}

export async function updateEmployee(employeeID: number, patch: Partial<CompanyEmployee>): Promise<void> {
  const updated = await api.updateEmployee(employeeID, patch);
  employees.update((all) => all.map((e) => (e.employeeID === employeeID ? updated : e)));
}

export async function deleteEmployee(employeeID: number): Promise<void> {
  await api.deleteEmployee(employeeID);
  employees.update((all) => all.filter((e) => e.employeeID !== employeeID));
}
