import type { ApiClient, AuthResult, CompanyEmployee, RoleDefinition, RoleName, Permission } from "$lib/api/types";

const API_URL = "http://localhost:5000/api";

async function fetchWithAuth(url: string, options: RequestInit = {}) {
    const token = localStorage.getItem("auth_token");
    return fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });
}

export const httpApiClient: ApiClient = {
    async login(username, password) {
        // Hier Authentik-Login integrieren (z.B. via OAuth2/OpenID Connect)
        // Beispiel: Token holen und speichern
        // const resp = await fetch("https://authentik.example.com/application/o/token/", ...)
        // localStorage.setItem("auth_token", resp.access_token)
        // ...
        return { success: false, error: "Authentik integration not implemented" };
    },
    async logout() {
        localStorage.removeItem("auth_token");
    },
    async getCurrentSession() {
        // Optional: Session-Check gegen Authentik
        return null;
    },
    async getProjects() {
        const resp = await fetchWithAuth(`${API_URL}/projects`);
        return resp.json();
    },
    async addProject(project) {
        const resp = await fetchWithAuth(`${API_URL}/projects`, {
            method: "POST",
            body: JSON.stringify(project),
        });
        return resp.json();
    },
    async updateProject(project) {
        const resp = await fetchWithAuth(`${API_URL}/projects/${project.projectID}`, {
            method: "PATCH",
            body: JSON.stringify(project),
        });
        return resp.json();
    },
    async getEmployees() {
        const resp = await fetchWithAuth(`${API_URL}/employees`);
        return resp.json();
    },
    async getCustomers() {
        const resp = await fetchWithAuth(`${API_URL}/customers`);
        return resp.json();
    },
    async addCustomer(customer) {
        const resp = await fetchWithAuth(`${API_URL}/customers`, {
            method: "POST",
            body: JSON.stringify(customer),
        });
        return resp.json();
    },
    async updateCustomer(customerID, patch) {
        const resp = await fetchWithAuth(`${API_URL}/customers/${customerID}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
        });
        return resp.json();
    },
    async deleteCustomer(customerID) {
        await fetchWithAuth(`${API_URL}/customers/${customerID}`, { method: "DELETE" });
    },
    async getRoles() {
        const resp = await fetchWithAuth(`${API_URL}/roles`);
        return resp.json();
    },
    async updateRole(role) {
        const resp = await fetchWithAuth(`${API_URL}/roles/${role.name}`, {
            method: "PATCH",
            body: JSON.stringify(role),
        });
        return resp.json();
    },
    async getHourlyRates() {
        const resp = await fetchWithAuth(`${API_URL}/hourlyrates`);
        return resp.json();
    },
    async saveHourlyRates(rates) {
        await fetchWithAuth(`${API_URL}/hourlyrates`, {
            method: "POST",
            body: JSON.stringify(rates),
        });
    },
    // Employees CRUD (Beispiel)
    async addEmployee(employee) {
        const resp = await fetchWithAuth(`${API_URL}/employees`, {
            method: "POST",
            body: JSON.stringify(employee),
        });
        return resp.json();
    },
    async updateEmployee(employeeID, patch) {
        const resp = await fetchWithAuth(`${API_URL}/employees/${employeeID}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
        });
        return resp.json();
    },
    async deleteEmployee(employeeID) {
        await fetchWithAuth(`${API_URL}/employees/${employeeID}`, { method: "DELETE" });
    },
};
