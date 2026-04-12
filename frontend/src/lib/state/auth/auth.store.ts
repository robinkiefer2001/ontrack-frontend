// $lib/state/auth/session.store.ts
import { writable } from "svelte/store";

export interface SessionUser {
  uid: string;        // X-authentik-uid
  username: string;   // X-authentik-username
  email: string;      // X-authentik-email
  name: string;       // X-authentik-name
  groups: string[];   // X-authentik-groups
}

export const sessionUser = writable<SessionUser | null>(null);
