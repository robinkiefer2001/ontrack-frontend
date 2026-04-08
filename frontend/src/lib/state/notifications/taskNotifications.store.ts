import { writable } from "svelte/store";

export interface TaskNotificationMessage {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  projectTitle: string;
  from: string;
  to: string;
  text: string;
  at: string;
  read: boolean;
}

const { subscribe, update } = writable<TaskNotificationMessage[]>([]);

function addMessage(message: Omit<TaskNotificationMessage, "id" | "at" | "read">) {
  update((items) => [
    {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      read: false,
      ...message,
    },
    ...items,
  ]);
}

function markAllAsReadForUser(userFullName: string) {
  update((items) =>
    items.map((item) => (item.to === userFullName ? { ...item, read: true } : item)),
  );
}

export const taskNotifications = {
  subscribe,
  addMessage,
  markAllAsReadForUser,
};
