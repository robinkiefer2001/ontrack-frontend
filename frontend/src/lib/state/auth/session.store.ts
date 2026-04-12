// src/lib/state/auth/session.store.ts
import { writable } from "svelte/store";

export interface SessionUser {
  uid: string;
  username: string;
  email: string;
  name: string;
}

export const sessionUser = writable<SessionUser | null>(null);

export async function loadSession(): Promise<void> {
  try {
    const res = await fetch("/api/me");
    if (res.ok) {
      sessionUser.set(await res.json());
    }
  } catch {
    sessionUser.set(null);
  }
}