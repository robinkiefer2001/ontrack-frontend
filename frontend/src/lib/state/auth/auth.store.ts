// src/lib/state/auth/auth.store.ts
import { writable } from "svelte/store";

export const isAuthenticated = writable(false);
export const authChecked = writable(false);

export async function checkSession(): Promise<void> {
  const res = await fetch("/api/me");
  if (res.ok) {
    isAuthenticated.set(true);
  } else {
    isAuthenticated.set(false);
  }
  authChecked.set(true);
}

export function logout(): void {
  window.location.href = "/outpost.goauthentik.io/sign_out";
}