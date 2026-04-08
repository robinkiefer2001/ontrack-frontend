import type { Project, Task } from "$lib/domain/project/types";
import {
  addToListProject,
  projectList,
} from "$lib/data/mock/projectDataSource";

export { projectList };

export function addProject(project: Project): void {
  addToListProject(project);
}

type AssignmentStatus = Task["status"];
type AssignmentMetaPatch = {
  isCritical?: boolean;
  riskNote?: string;
};

function parseAssignmentId(assignmentId: string): {
  kind: "task" | "subtask";
  projectId: number;
  taskId: number;
  subtaskId?: number;
} | null {
  const parts = assignmentId.split("-");
  if (parts[0] !== "task" && parts[0] !== "subtask") return null;

  const projectId = Number(parts[1]);
  const taskId = Number(parts[2]);
  const subtaskId = parts[0] === "subtask" ? Number(parts[3]) : undefined;

  if (!Number.isFinite(projectId) || !Number.isFinite(taskId)) return null;
  if (parts[0] === "subtask" && !Number.isFinite(subtaskId)) return null;

  return {
    kind: parts[0],
    projectId,
    taskId,
    subtaskId,
  };
}

export function updateAssignmentStatus(assignmentId: string, status: AssignmentStatus): void {
  const parsed = parseAssignmentId(assignmentId);
  if (!parsed) return;

  projectList.update((projects) =>
    projects.map((project) => {
      if (project.projectID !== parsed.projectId) return project;

      return {
        ...project,
        Tasks: project.Tasks.map((task) => {
          if (task.taskID !== parsed.taskId) return task;

          if (parsed.kind === "task") {
            return {
              ...task,
              status,
            };
          }

          return {
            ...task,
            subtasks: task.subtasks.map((subtask) =>
              subtask.subtaskID === parsed.subtaskId
                ? {
                  ...subtask,
                  status,
                }
                : subtask,
            ),
          };
        }),
      };
    }),
  );
}

export function setAssignmentHoursFromLogged(assignmentId: string, loggedHours: number): void {
  const parsed = parseAssignmentId(assignmentId);
  if (!parsed) return;

  const normalized = Math.max(0, Number(loggedHours.toFixed(2)));

  projectList.update((projects) =>
    projects.map((project) => {
      if (project.projectID !== parsed.projectId) return project;

      return {
        ...project,
        Tasks: project.Tasks.map((task) => {
          if (task.taskID !== parsed.taskId) return task;

          if (parsed.kind === "task") {
            return {
              ...task,
              estimatedHours: normalized,
            };
          }

          return {
            ...task,
            subtasks: task.subtasks.map((subtask) =>
              subtask.subtaskID === parsed.subtaskId
                ? {
                  ...subtask,
                  estimatedHours: normalized,
                }
                : subtask,
            ),
          };
        }),
      };
    }),
  );
}

export function updateAssignmentMeta(assignmentId: string, patch: AssignmentMetaPatch): void {
  const parsed = parseAssignmentId(assignmentId);
  if (!parsed) return;

  projectList.update((projects) =>
    projects.map((project) => {
      if (project.projectID !== parsed.projectId) return project;

      return {
        ...project,
        Tasks: project.Tasks.map((task) => {
          if (task.taskID !== parsed.taskId) return task;

          if (parsed.kind === "task") {
            return {
              ...task,
              ...(patch.isCritical !== undefined ? { isCritical: patch.isCritical } : {}),
              ...(patch.riskNote !== undefined ? { riskNote: patch.riskNote } : {}),
            };
          }

          return {
            ...task,
            subtasks: task.subtasks.map((subtask) =>
              subtask.subtaskID === parsed.subtaskId
                ? {
                  ...subtask,
                  ...(patch.isCritical !== undefined ? { isCritical: patch.isCritical } : {}),
                  ...(patch.riskNote !== undefined ? { riskNote: patch.riskNote } : {}),
                }
                : subtask,
            ),
          };
        }),
      };
    }),
  );
}
