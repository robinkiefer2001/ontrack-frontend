import type { HourlyRate, Project } from "$lib/domain/project/types";
import { getHourlyRate } from "$lib/domain/project/hourlyRates";
import { getCurrentPhase, getProjectBudgetSummary, isProjectOnTrack } from "$lib/domain/project/services";
import type { Assignment, DashboardState, ProjectSnapshot, WorkStatus } from "$lib/domain/dashboard/types";

export function getStatusCounts(items: Assignment[]): Record<WorkStatus, number> {
  return items.reduce(
    (counts, item) => {
      counts[item.status] += 1;
      return counts;
    },
    {
      Pending: 0,
      "To Do": 0,
      "In Progress": 0,
      Done: 0,
    } as Record<WorkStatus, number>,
  );
}

export function filterUserProjects(
  allProjects: Project[],
  currentUserFullName: string,
): Project[] {
  return allProjects.filter((project) => {
    return (project.Tasks || []).some(
      (task) =>
        task.assignedTo === currentUserFullName ||
        (task.subtasks || []).some((subtask) => subtask.assignedTo === currentUserFullName),
    );
  });
}

export function collectAssignments(
  project: Project,
  userName: string,
  hourlyRates: HourlyRate[],
): Assignment[] {
  const today = normalizeDate(new Date());
  const nextWeek = today ? new Date(today) : null;
  nextWeek?.setDate(nextWeek.getDate() + 7);

  return (project.Tasks || []).flatMap((task) => {
    const items: Assignment[] = [];

    if (task.assignedTo === userName) {
      const dueDate = normalizeDate(task.dueDate);
      const estimatedHours = task.estimatedHours || 0;
      const cost = estimatedHours * getHourlyRate(task.hourlyRateType, hourlyRates);

      items.push({
        id: `task-${project.projectID}-${task.taskID}`,
        kind: "task",
        title: task.title,
        projectTitle: project.title,
        status: task.status,
        dueDate,
        estimatedHours,
        cost,
        isOverdue: Boolean(dueDate && today && task.status !== "Done" && dueDate < today),
        isDueSoon: Boolean(
          dueDate &&
            today &&
            nextWeek &&
            task.status !== "Done" &&
            dueDate >= today &&
            dueDate <= nextWeek,
        ),
      });
    }

    (task.subtasks || []).forEach((subtask) => {
      if (subtask.assignedTo !== userName) return;

      const dueDate = normalizeDate(subtask.dueDate);
      const estimatedHours = subtask.estimatedHours || 0;
      const cost = estimatedHours * getHourlyRate(subtask.hourlyRateType, hourlyRates);

      items.push({
        id: `subtask-${project.projectID}-${task.taskID}-${subtask.subtaskID}`,
        kind: "subtask",
        title: `${task.title} / ${subtask.title}`,
        projectTitle: project.title,
        status: subtask.status,
        dueDate,
        estimatedHours,
        cost,
        isOverdue: Boolean(dueDate && today && subtask.status !== "Done" && dueDate < today),
        isDueSoon: Boolean(
          dueDate &&
            today &&
            nextWeek &&
            subtask.status !== "Done" &&
            dueDate >= today &&
            dueDate <= nextWeek,
        ),
      });
    });

    return items;
  });
}

export function buildProjectSnapshots(
  projects: Project[],
  currentUserFullName: string,
  hourlyRates: HourlyRate[],
): ProjectSnapshot[] {
  return projects
    .map((project) => {
      const summary = getProjectBudgetSummary(project, hourlyRates);
      const relevantItems = collectAssignments(project, currentUserFullName, hourlyRates);
      const openItems = relevantItems.filter((item) => item.status !== "Done").length;
      const overdueItems = relevantItems.filter((item) => item.isOverdue).length;

      return {
        project,
        phase: getCurrentPhase(project) ?? "-",
        budgetUsage: summary.percentageUsed,
        reserveBudget: summary.reserveBudget,
        openItems,
        overdueItems,
        dueDate: project.dueDate ? new Date(project.dueDate) : null,
        onTrack: isProjectOnTrack(project) && overdueItems === 0,
      };
    })
    .sort((left, right) => {
      if (left.overdueItems !== right.overdueItems) {
        return right.overdueItems - left.overdueItems;
      }
      if (left.onTrack !== right.onTrack) {
        return left.onTrack ? 1 : -1;
      }
      return (right.budgetUsage || 0) - (left.budgetUsage || 0);
    });
}

export function buildDashboardState(
  projects: Project[],
  currentUserFullName: string,
  hourlyRates: HourlyRate[],
): DashboardState {
  const userProjects = filterUserProjects(projects, currentUserFullName);
  const assignments = userProjects.flatMap((project) =>
    collectAssignments(project, currentUserFullName, hourlyRates),
  );

  const priorityAssignments = assignments
    .filter((item) => item.status !== "Done")
    .sort((left, right) => {
      if (left.isOverdue !== right.isOverdue) return left.isOverdue ? -1 : 1;
      if (left.isDueSoon !== right.isDueSoon) return left.isDueSoon ? -1 : 1;
      if (left.dueDate && right.dueDate) return left.dueDate.getTime() - right.dueDate.getTime();
      if (left.dueDate) return -1;
      if (right.dueDate) return 1;
      return right.estimatedHours - left.estimatedHours;
    })
    .slice(0, 6);

  const projectSnapshots = buildProjectSnapshots(userProjects, currentUserFullName, hourlyRates).slice(0, 5);

  return {
    userProjects,
    assignments,
    priorityAssignments,
    projectSnapshots,
    statusCounts: getStatusCounts(assignments),
  };
}

export function calculateCompletionRate(assignments: Assignment[]): number {
  if (assignments.length === 0) return 0;
  const completedItems = assignments.filter((item) => item.status === "Done").length;
  return (completedItems / assignments.length) * 100;
}

export function calculatePortfolioHealth(
  snapshots: ProjectSnapshot[],
  totalProjects: number,
): number {
  if (totalProjects === 0) return 0;
  const healthyProjects = snapshots.filter((project) => project.onTrack).length;
  return (healthyProjects / totalProjects) * 100;
}

export function getOpenItemsCount(assignments: Assignment[]): number {
  return assignments.filter((item) => item.status !== "Done").length;
}

export function getOverdueCount(assignments: Assignment[]): number {
  return assignments.filter((item) => item.isOverdue).length;
}

export function getDueSoonCount(assignments: Assignment[]): number {
  return assignments.filter((item) => item.isDueSoon).length;
}

export function getAssignedHours(assignments: Assignment[]): number {
  return assignments.reduce((sum, item) => sum + item.estimatedHours, 0);
}

export function getAssignedBudgetTotal(assignments: Assignment[]): number {
  return assignments.reduce((sum, item) => sum + item.cost, 0);
}

export function getTimelineDayDiffLabel(
  dueDate: Date | null,
  today: Date,
): number | null {
  if (!dueDate) return null;
  const normalizedToday = normalizeDate(today);
  if (!normalizedToday) return null;
  return Math.round((dueDate.getTime() - normalizedToday.getTime()) / 86400000);
}

function normalizeDate(value: Date | null): Date | null {
  if (!value) return null;
  const normalized = new Date(value);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}
