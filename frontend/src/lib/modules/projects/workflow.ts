import type { HourlyRate, Project, ProjectPhase, Task } from "$lib/modules/projects/contracts";
import type { SubtaskDraft, SubtaskDraftItem, TaskDraft } from "$lib/modules/projects/models";
import { toDateOrNull } from "$lib/utils/date";
import { getPhaseRange, getTaskCost, getAssignedBudget } from "$lib/modules/projects/business";

export type SubtaskValidationResult = "ok" | "invalid-range" | "before-task" | "after-task";

export function syncProjectPhaseDates(project: Project | null): void {
  if (!project) return;

  if (project.startDate && project.initiationPhase[0]) {
    project.initiationPhase[0].startDate = project.startDate;
  }

  if (project.dueDate && project.closurePhase[0]) {
    project.closurePhase[0].dueDate = project.dueDate;
  }

  if (project.initiationPhase[0]?.startDate && project.startDate !== project.initiationPhase[0].startDate) {
    project.startDate = project.initiationPhase[0].startDate;
  }

  if (project.closurePhase[0]?.dueDate && project.dueDate !== project.closurePhase[0].dueDate) {
    project.dueDate = project.closurePhase[0].dueDate;
  }

  if (project.initiationPhase[0]?.dueDate && project.planingPhase[0]) {
    project.planingPhase[0].startDate = project.initiationPhase[0].dueDate;
  }

  if (project.planingPhase[0]?.dueDate && project.executionPhase[0]) {
    project.executionPhase[0].startDate = project.planingPhase[0].dueDate;
  }

  if (project.executionPhase[0]?.dueDate && project.closurePhase[0]) {
    project.closurePhase[0].startDate = project.executionPhase[0].dueDate;
  }
}

export function applyTaskPhase(project: Project | null, draft: TaskDraft, name: ProjectPhase["phaseName"]): void {
  if (!project) return;

  draft.projectPhase = name;
  const map: Record<ProjectPhase["phaseName"], number | null> = {
    Initiation: project.initiationPhase[0]?.phaseid ?? null,
    Planing: project.planingPhase[0]?.phaseid ?? null,
    Execution: project.executionPhase[0]?.phaseid ?? null,
    Closure: project.closurePhase[0]?.phaseid ?? null,
  };

  draft.phaseid = map[name];

  const { start, end } = getPhaseRange(project, name);
  draft.startDate = start;
  draft.dueDate = end;
}

export function buildTaskFromDraft(
  project: Project,
  draft: TaskDraft,
  subtasks: SubtaskDraftItem[],
): Task | null {
  const taskStart = toDateOrNull(draft.startDate);
  const taskEnd = toDateOrNull(draft.dueDate);

  if (!draft.title.trim() || !draft.projectPhase || !taskStart || !taskEnd) return null;

  const { start: phaseStartRaw, end: phaseEndRaw } = getPhaseRange(
    project,
    draft.projectPhase as ProjectPhase["phaseName"],
  );
  const phaseStart = toDateOrNull(phaseStartRaw);
  const phaseEnd = toDateOrNull(phaseEndRaw);

  if ((phaseStart && taskStart < phaseStart) || (phaseEnd && taskEnd > phaseEnd) || taskStart > taskEnd) {
    return null;
  }

  return {
    taskID: Date.now(),
    projectID: project.projectID || 0,
    title: draft.title,
    phaseId: draft.phaseid,
    projectPhase: draft.projectPhase,
    description: draft.description,
    status: draft.status as "Pending",
    assignedTo: draft.assignedTo,
    dueDate: taskEnd,
    startDate: taskStart,
    notificationSent: false,
    estimatedHours: draft.estimatedHours,
    hourlyRateType: draft.hourlyRateType,
    subtasks,
  };
}

export function exceedsProjectBudget(project: Project, task: Task, rates: HourlyRate[]): boolean {
  if (!project.budget || project.budget <= 0) return false;
  const nextAssignedBudget = getAssignedBudget(project, rates) + getTaskCost(task, rates);
  return nextAssignedBudget > project.budget;
}

export function validateSubtaskAgainstTaskWindow(
  subtaskDraft: SubtaskDraft,
  taskDraft: TaskDraft,
): SubtaskValidationResult {
  const subtaskStart = toDateOrNull(subtaskDraft.startDate);
  const subtaskEnd = toDateOrNull(subtaskDraft.dueDate);
  const taskStart = toDateOrNull(taskDraft.startDate);
  const taskEnd = toDateOrNull(taskDraft.dueDate);

  if (!subtaskStart || !subtaskEnd) return "ok";
  if (subtaskStart > subtaskEnd) return "invalid-range";
  if (taskStart && subtaskStart < taskStart) return "before-task";
  if (taskEnd && subtaskEnd > taskEnd) return "after-task";
  return "ok";
}

export function buildSubtaskFromDraft(draft: SubtaskDraft): SubtaskDraftItem | null {
  if (!draft.title.trim()) return null;

  return {
    subtaskID: Date.now() + Math.random(),
    taskID: 0,
    title: draft.title,
    description: draft.description,
    status: draft.status as "Pending",
    assignedTo: draft.assignedTo,
    dueDate: toDateOrNull(draft.dueDate),
    startDate: toDateOrNull(draft.startDate),
    estimatedHours: draft.estimatedHours,
    hourlyRateType: draft.hourlyRateType,
  };
}

export function normalizeProjectBeforeSubmit(project: Project): Project {
  const parsedBudget =
    project.budget === null || project.budget === 0
      ? null
      : Number(project.budget);

  return {
    ...project,
    budget: Number.isNaN(parsedBudget) ? null : parsedBudget,
    startDate: toDateOrNull(project.startDate as Date | string | null),
    dueDate: toDateOrNull(project.dueDate as Date | string | null),
  };
}

export function mapTaskToDraft(task: Task): TaskDraft {
  return {
    title: task.title,
    description: task.description || "",
    status: task.status,
    assignedTo: task.assignedTo || "",
    phaseid: task.phaseId,
    projectPhase: task.projectPhase || "",
    dueDate: task.dueDate ? task.dueDate.toISOString().split("T")[0] : null,
    startDate: task.startDate ? task.startDate.toISOString().split("T")[0] : null,
    estimatedHours: task.estimatedHours,
    hourlyRateType: task.hourlyRateType,
    isCritical: task.isCritical ?? false,
    riskNote: task.riskNote ?? "",
  };
}

export function toggleTaskIdSelection(current: Set<number>, taskID: number): Set<number> {
  const next = new Set(current);
  if (next.has(taskID)) {
    next.delete(taskID);
  } else {
    next.add(taskID);
  }
  return next;
}

export function toggleAllTaskIds(current: Set<number>, tasks: Task[]): Set<number> {
  if (current.size === tasks.length) return new Set<number>();
  return new Set(tasks.map((t) => t.taskID));
}

export function removeSelectedTasks(tasks: Task[], selectedTaskIDs: Set<number>): Task[] {
  return tasks.filter((t) => !selectedTaskIDs.has(t.taskID));
}
