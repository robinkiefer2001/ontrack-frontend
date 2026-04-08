import type { Customer, CustomerEmployee, HourlyRate, Project } from "$lib/domain/project/types";
import type { ApiClient, AuthResult, CompanyEmployee, Permission, RoleDefinition, RoleName } from "$lib/api/types";
import { companyEmployeeList, customerList, projectList, addToListProject } from "$lib/data/mock/projectDataSource";
import { loadHourlyRates, saveHourlyRates } from "$lib/domain/project/hourlyRates";
import { get } from "svelte/store";

/** Mock auth token key in localStorage. */
const AUTH_TOKEN_KEY = "auth_token";
const AUTH_USER_KEY = "auth_user";

/** Generate a username from first+last name (lowercase, dot-separated). */
function toUsername(firstName: string, lastName: string): string {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
}

/** All mock users share this password. */
const MOCK_PASSWORD = "1234";

/** Default RBAC role definitions for a project management company. */
const DEFAULT_ROLES: RoleDefinition[] = [
  {
    name: "Admin",
    permissions: [
      "projects.create", "projects.edit", "projects.delete", "projects.view", "projects.assign_team",
      "tasks.create", "tasks.edit", "tasks.delete", "tasks.view",
      "users.create", "users.edit", "users.delete", "users.view",
      "customers.create", "customers.edit", "customers.delete", "customers.view",
      "roles.manage", "rates.manage", "employment.manage", "admin.access",
    ],
  },
  {
    name: "ProjectManager",
    permissions: [
      "projects.create", "projects.edit", "projects.view", "projects.assign_team",
      "tasks.create", "tasks.edit", "tasks.delete", "tasks.view",
      "users.view",
      "customers.create", "customers.edit", "customers.view",
      "employment.manage",
    ],
  },
  {
    name: "TeamLead",
    permissions: [
      "projects.view", "projects.assign_team",
      "tasks.create", "tasks.edit", "tasks.view",
      "users.view",
      "customers.view",
    ],
  },
  {
    name: "Developer",
    permissions: [
      "projects.view",
      "tasks.edit", "tasks.view",
      "users.view",
      "customers.view",
    ],
  },
  {
    name: "Viewer",
    permissions: [
      "projects.view",
      "tasks.view",
      "users.view",
      "customers.view",
    ],
  },
];

const ROLE_FOR_JOB: Record<string, RoleName> = {
  "Project Manager": "ProjectManager",
  "Technical Lead": "TeamLead",
  "Business Analyst": "Developer",
  "System Engineer": "Developer",
  "QA Engineer": "Developer",
  "Product Owner": "ProjectManager",
};

function loadRoles(): RoleDefinition[] {
  if (typeof window === "undefined") return DEFAULT_ROLES;
  const stored = localStorage.getItem("rbac_roles");
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  return DEFAULT_ROLES;
}

function saveRoles(roles: RoleDefinition[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("rbac_roles", JSON.stringify(roles));
  }
}

function loadEmployees(): CompanyEmployee[] {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("company_employees");
    if (stored) {
      try { return JSON.parse(stored); } catch { /* fall through */ }
    }
  }

  // Seed from mock data — first user is Admin, rest derive from jobTitle
  const seeded: CompanyEmployee[] = companyEmployeeList.map((emp, idx) => ({
    ...emp,
    role: idx === 0 ? "Admin" : (ROLE_FOR_JOB[emp.jobTitle ?? ""] ?? "Developer"),
    employmentPercent: 100,
    defaultHoursPerWeek: 42,
  }));
  saveEmployees(seeded);
  return seeded;
}

function saveEmployees(employees: CompanyEmployee[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("company_employees", JSON.stringify(employees));
  }
}

function loadCustomers(): Customer[] {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("customers");
    if (stored) {
      try { return JSON.parse(stored); } catch { /* fall through */ }
    }
  }
  const seeded = [...customerList];
  saveCustomers(seeded);
  return seeded;
}

function saveCustomers(customers: Customer[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("customers", JSON.stringify(customers));
  }
}

let employeeCache: CompanyEmployee[] = loadEmployees();
let rolesCache: RoleDefinition[] = loadRoles();

/**
 * Mock API client — simulates async backend calls with localStorage persistence.
 * Swap this with real HTTP fetch when the backend is ready.
 */
export const mockApiClient: ApiClient = {
  // ── Authentication ─────────────────────────────────────────────────────
  async login(username: string, password: string): Promise<AuthResult> {
    if (password !== MOCK_PASSWORD) {
      return { success: false, error: "Invalid username or password." };
    }
    const employees = loadEmployees();
    const match = employees.find(
      (e) => toUsername(e.firstName, e.lastName) === username.toLowerCase(),
    );
    if (!match) {
      return { success: false, error: "Invalid username or password." };
    }
    const token = `mock-token-${match.employeeID}-${Date.now()}`;
    if (typeof window !== "undefined") {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(match));
    }
    return { success: true, token, user: match };
  },

  async logout(): Promise<void> {
    if (typeof window !== "undefined") {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    }
  },

  async getCurrentSession(): Promise<CompanyEmployee | null> {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const userJson = localStorage.getItem(AUTH_USER_KEY);
    if (!token || !userJson) return null;
    try {
      return JSON.parse(userJson) as CompanyEmployee;
    } catch {
      return null;
    }
  },

  // ── Employees ──────────────────────────────────────────────────────────
  async getEmployees(): Promise<CompanyEmployee[]> {
    employeeCache = loadEmployees();
    return employeeCache;
  },

  async addEmployee(employee: Omit<CompanyEmployee, "employeeID">): Promise<CompanyEmployee> {
    const employees = loadEmployees();
    const newId = Math.max(...employees.map((e) => e.employeeID), 0) + 1;
    const created: CompanyEmployee = { ...employee, employeeID: newId };
    employees.push(created);
    saveEmployees(employees);
    employeeCache = employees;
    return created;
  },

  async updateEmployee(employeeID: number, patch: Partial<CompanyEmployee>): Promise<CompanyEmployee> {
    const employees = loadEmployees();
    const idx = employees.findIndex((e) => e.employeeID === employeeID);
    if (idx === -1) throw new Error(`Employee ${employeeID} not found`);
    employees[idx] = { ...employees[idx], ...patch, employeeID };
    saveEmployees(employees);
    employeeCache = employees;
    return employees[idx];
  },

  async deleteEmployee(employeeID: number): Promise<void> {
    let employees = loadEmployees();
    employees = employees.filter((e) => e.employeeID !== employeeID);
    saveEmployees(employees);
    employeeCache = employees;
  },

  // ── Projects ───────────────────────────────────────────────────────────
  async getProjects(): Promise<Project[]> {
    return get(projectList);
  },

  async addProject(project: Project): Promise<Project> {
    addToListProject(project);
    return project;
  },

  async updateProject(project: Project): Promise<Project> {
    projectList.update((all) => all.map((p) => (p.projectID === project.projectID ? project : p)));
    return project;
  },

  // ── Customers ──────────────────────────────────────────────────────────
  async getCustomers(): Promise<Customer[]> {
    return loadCustomers();
  },

  async addCustomer(customer: Omit<Customer, "customerID">): Promise<Customer> {
    const customers = loadCustomers();
    const newId = Math.max(...customers.map((c) => c.customerID), 0) + 1;
    const created: Customer = { ...customer, customerID: newId };
    customers.push(created);
    saveCustomers(customers);
    return created;
  },

  async updateCustomer(customerID: number, patch: Partial<Customer>): Promise<Customer> {
    const customers = loadCustomers();
    const idx = customers.findIndex((c) => c.customerID === customerID);
    if (idx === -1) throw new Error(`Customer ${customerID} not found`);
    customers[idx] = { ...customers[idx], ...patch, customerID };
    saveCustomers(customers);
    return customers[idx];
  },

  async deleteCustomer(customerID: number): Promise<void> {
    let customers = loadCustomers();
    customers = customers.filter((c) => c.customerID !== customerID);
    saveCustomers(customers);
  },

  // ── Roles ──────────────────────────────────────────────────────────────
  async getRoles(): Promise<RoleDefinition[]> {
    rolesCache = loadRoles();
    return rolesCache;
  },

  async updateRole(role: RoleDefinition): Promise<RoleDefinition> {
    const roles = loadRoles();
    const idx = roles.findIndex((r) => r.name === role.name);
    if (idx === -1) throw new Error(`Role ${role.name} not found`);
    roles[idx] = role;
    saveRoles(roles);
    rolesCache = roles;
    return role;
  },

  // ── Hourly Rates ───────────────────────────────────────────────────────
  async getHourlyRates(): Promise<HourlyRate[]> {
    return loadHourlyRates();
  },

  async saveHourlyRates(rates: HourlyRate[]): Promise<void> {
    saveHourlyRates(rates);
  },
};
