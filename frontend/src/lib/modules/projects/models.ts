import type { Project, ProjectPhase, ProjectStatus, Task } from "$lib/modules/projects/contracts";

export interface TaskDraft {
  title: string;
  description: string;
  status: Task["status"];
  assignedTo: string;
  phaseid: number | null;
  projectPhase: string;
  dueDate: Date | string | null;
  startDate: Date | string | null;
  estimatedHours: number | null;
  hourlyRateType: string;
  isCritical: boolean;
  riskNote: string;
}

export interface SubtaskDraft {
  title: string;
  description: string;
  status: Task["status"];
  assignedTo: string;
  dueDate: Date | string | null;
  startDate: Date | string | null;
  estimatedHours: number | null;
  hourlyRateType: string;
  isCritical: boolean;
  riskNote: string;
}

export type SubtaskDraftItem = Task["subtasks"][number];

export function createEmptyTaskDraft(): TaskDraft {
  return {
    title: "",
    description: "",
    status: "Pending",
    assignedTo: "",
    phaseid: null,
    projectPhase: "",
    dueDate: null,
    startDate: null,
    estimatedHours: null,
    hourlyRateType: "SystemEngineer",
    isCritical: false,
    riskNote: "",
  };
}

export function createEmptySubtaskDraft(): SubtaskDraft {
  return {
    title: "",
    description: "",
    status: "Pending",
    assignedTo: "",
    dueDate: null,
    startDate: null,
    estimatedHours: null,
    hourlyRateType: "SystemEngineer",
    isCritical: false,
    riskNote: "",
  };
}

export function createEmptyProject(projectId: number): Project {
  const createPhase = (offset: number, phaseName: ProjectPhase["phaseName"]): ProjectPhase => ({
    phaseid: projectId + offset,
    projectID: projectId,
    phaseName,
    startDate: null,
    dueDate: null,
  });

  return {
    title: "",
    customerID: null,
    customerName: "",
    budget: null,
    dueDate: null,
    startDate: null,
    projectID: projectId,
    projectManager: "",
    projectstatus: "Initiation" as ProjectStatus,
    risks: [],
    initiationPhase: [createPhase(0, "Initiation")],
    planingPhase: [createPhase(1, "Planing")],
    executionPhase: [createPhase(2, "Execution")],
    closurePhase: [createPhase(3, "Closure")],
    Tasks: [],
  };
}
