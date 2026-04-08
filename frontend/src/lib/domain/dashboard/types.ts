import type { Project, Task } from "$lib/domain/project/types";

export type WorkStatus = Task["status"];

export interface Assignment {
  id: string;
  kind: "task" | "subtask";
  title: string;
  projectTitle: string;
  status: WorkStatus;
  dueDate: Date | null;
  estimatedHours: number;
  cost: number;
  isOverdue: boolean;
  isDueSoon: boolean;
}

export interface ProjectSnapshot {
  project: Project;
  phase: string;
  budgetUsage: number;
  reserveBudget: number;
  openItems: number;
  overdueItems: number;
  dueDate: Date | null;
  onTrack: boolean;
}

export interface DashboardState {
  userProjects: Project[];
  assignments: Assignment[];
  priorityAssignments: Assignment[];
  projectSnapshots: ProjectSnapshot[];
  statusCounts: Record<WorkStatus, number>;
}
