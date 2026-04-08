import { writable, derived } from "svelte/store";
import { api, type CompanyEmployee } from "$lib/api";
import { currentUser } from "$lib/state/user/currentUser.store";

/** Whether authentication state has been checked on app start. */
export const authChecked = writable(false);

/** Whether the user is currently authenticated. */
export const isAuthenticated = writable(false);

/** The authenticated user (from the API session). */
export const authUser = writable<CompanyEmployee | null>(null);

/** Check localStorage for an existing session on startup. */
export async function checkSession(): Promise<boolean> {
  const user = await api.getCurrentSession();
  if (user) {
    isAuthenticated.set(true);
    authUser.set(user);
    currentUser.set({
      employeeID: user.employeeID,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? "",
      jobTitle: user.jobTitle ?? "",
      department: user.department ?? "",
    });
  } else {
    isAuthenticated.set(false);
    authUser.set(null);
  }
  authChecked.set(true);
  return !!user;
}

/** Log in with username and password. */
export async function login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
  const result = await api.login(username, password);
  if (result.success && result.user) {
    isAuthenticated.set(true);
    authUser.set(result.user);
    currentUser.set({
      employeeID: result.user.employeeID,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      email: result.user.email,
      phone: result.user.phone ?? "",
      jobTitle: result.user.jobTitle ?? "",
      department: result.user.department ?? "",
    });
    return { success: true };
  }
  return { success: false, error: result.error };
}

/** Log out the current user. */
export async function logout(): Promise<void> {
  await api.logout();
  isAuthenticated.set(false);
  authUser.set(null);
  currentUser.reset();
}
