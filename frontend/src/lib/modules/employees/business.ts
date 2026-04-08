import type { CustomerEmployee, Project, Task } from "$lib/domain/project/types";
import { getTaskCost } from "$lib/domain/project/services";
import { DEFAULT_HOURLY_RATES } from "$lib/domain/project/hourlyRates";

export interface EmployeeWorkload {
  employee: CustomerEmployee;
  fullName: string;
  totalTasks: number;
  totalSubtasks: number;
  totalHours: number;
  totalCost: number;
  projectCount: number;
  projectNames: string[];
  isOnTrack: boolean;
  assignments: EmployeeAssignment[];
}

export interface EmployeeAssignment {
  projectTitle: string;
  projectID: number | null;
  taskTitle: string;
  taskID: number;
  type: "task" | "subtask";
  status: "To Do" | "In Progress" | "Done" | "Pending";
  dueDate: Date | null;
  estimatedHours: number | null;
  cost: number;
  isOverdue: boolean;
  parentTaskTitle?: string;
}

export function buildEmployeeWorkload(
  employee: CustomerEmployee,
  projects: Project[],
): EmployeeWorkload {
  const fullName = `${employee.firstName} ${employee.lastName}`.trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const assignments: EmployeeAssignment[] = [];
  const projectSet = new Set<string>();
  let isOnTrack = true;

  for (const project of projects) {
    for (const task of project.Tasks || []) {
      if (task.assignedTo?.trim() === fullName) {
        const taskDue = task.dueDate ? new Date(task.dueDate) : null;
        const isOverdue = task.status !== "Done" && !!taskDue && today > taskDue;
        if (isOverdue) isOnTrack = false;

        const rate = DEFAULT_HOURLY_RATES.find((r) => r.rateType === task.hourlyRateType);
        const cost = (task.estimatedHours || 0) * (rate?.hourlyRate || 0);

        assignments.push({
          projectTitle: project.title,
          projectID: project.projectID,
          taskTitle: task.title,
          taskID: task.taskID,
          type: "task",
          status: task.status,
          dueDate: task.dueDate,
          estimatedHours: task.estimatedHours,
          cost,
          isOverdue,
        });
        projectSet.add(project.title);
      }

      for (const subtask of task.subtasks || []) {
        if (subtask.assignedTo?.trim() === fullName) {
          const subDue = subtask.dueDate ? new Date(subtask.dueDate) : null;
          const isOverdue = subtask.status !== "Done" && !!subDue && today > subDue;
          if (isOverdue) isOnTrack = false;

          const rate = DEFAULT_HOURLY_RATES.find((r) => r.rateType === subtask.hourlyRateType);
          const cost = (subtask.estimatedHours || 0) * (rate?.hourlyRate || 0);

          assignments.push({
            projectTitle: project.title,
            projectID: project.projectID,
            taskTitle: subtask.title,
            taskID: subtask.subtaskID,
            type: "subtask",
            status: subtask.status,
            dueDate: subtask.dueDate,
            estimatedHours: subtask.estimatedHours,
            cost,
            isOverdue,
            parentTaskTitle: task.title,
          });
          projectSet.add(project.title);
        }
      }
    }
  }

  return {
    employee,
    fullName,
    totalTasks: assignments.filter((a) => a.type === "task").length,
    totalSubtasks: assignments.filter((a) => a.type === "subtask").length,
    totalHours: assignments.reduce((sum, a) => sum + (a.estimatedHours || 0), 0),
    totalCost: assignments.reduce((sum, a) => sum + a.cost, 0),
    projectCount: projectSet.size,
    projectNames: Array.from(projectSet).sort(),
    isOnTrack,
    assignments,
  };
}

export function getUniqueDepartments(employees: CustomerEmployee[]): string[] {
  const departments = new Set<string>();
  for (const emp of employees) {
    if (emp.department) departments.add(emp.department);
  }
  return Array.from(departments).sort();
}
