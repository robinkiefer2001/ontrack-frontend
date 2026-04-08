import { writable } from "svelte/store";

export interface WorkLogEntry {
  id: string;
  assignmentId: string;
  date: string;
  hours: number;
  description: string;
  author: string;
}

const { subscribe, update } = writable<WorkLogEntry[]>([]);

function addEntry(entry: Omit<WorkLogEntry, "id">) {
  update((items) => [
    {
      id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...entry,
    },
    ...items,
  ]);
}

function removeEntry(id: string) {
  update((items) => items.filter((item) => item.id !== id));
}

export const workLogStore = {
  subscribe,
  addEntry,
  removeEntry,
};
