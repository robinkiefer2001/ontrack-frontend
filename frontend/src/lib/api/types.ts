import type { Customer, CustomerEmployee, HourlyRate, Project } from "$lib/domain/project/types";

/** Roles assignable to company employees. */
export type RoleName = "Admin" | "ProjectManager" | "TeamLead" | "Developer" | "Viewer";

/** Granular permissions a role can grant. */
export type Permission =
  | "projects.create"
  | "projects.edit"
  | "projects.delete"
  | "projects.view"
  | "projects.assign_team"
  | "tasks.create"
  | "tasks.edit"
  | "tasks.delete"
  | "tasks.view"
  | "users.create"
  | "users.edit"
  | "users.delete"
  | "users.view"
  | "roles.manage"
  | "customers.create"
  | "customers.edit"
  | "customers.delete"
  | "customers.view"
  | "rates.manage"
  | "employment.manage"
  | "admin.access";

export interface RoleDefinition {
  name: RoleName;
  permissions: Permission[];
}

export interface CompanyEmployee extends CustomerEmployee {
  role: RoleName;
}

/** Result returned by the login endpoint. */
export interface AuthResult {
  success: boolean;
  token?: string;
  user?: CompanyEmployee;
  error?: string;
}

/**
 * Contract for backend API.
 * Currently fulfilled by mock implementation; will be swapped for real HTTP client.
 */
export interface ApiClient {
  // Authentication
  login(username: string, password: string): Promise<AuthResult>;
  logout(): Promise<void>;
  getCurrentSession(): Promise<CompanyEmployee | null>;

  // Employees
  getEmployees(): Promise<CompanyEmployee[]>;
  addEmployee(employee: Omit<CompanyEmployee, "employeeID">): Promise<CompanyEmployee>;
  updateEmployee(employeeID: number, patch: Partial<CompanyEmployee>): Promise<CompanyEmployee>;
  deleteEmployee(employeeID: number): Promise<void>;

  // Projects
  getProjects(): Promise<Project[]>;
  addProject(project: Project): Promise<Project>;
  updateProject(project: Project): Promise<Project>;

  // Customers
  getCustomers(): Promise<Customer[]>;
  addCustomer(customer: Omit<Customer, "customerID">): Promise<Customer>;
  updateCustomer(customerID: number, patch: Partial<Customer>): Promise<Customer>;
  deleteCustomer(customerID: number): Promise<void>;

  // Roles & RBAC
  getRoles(): Promise<RoleDefinition[]>;
  updateRole(role: RoleDefinition): Promise<RoleDefinition>;

  // Hourly Rates
  getHourlyRates(): Promise<HourlyRate[]>;
  saveHourlyRates(rates: HourlyRate[]): Promise<void>;
}
