import type {
  Project,
  ProjectPhase,
  Task,
  HourlyRate,
} from "$lib/domain/project/types";
import {
  DEFAULT_HOURLY_RATES,
  getHourlyRate,
} from "$lib/domain/project/hourlyRates";
import { toInputDate } from "$lib/utils/date";

export function countProjects(projects: Project[]): number {
  return projects.length;
}

export function getPhaseRange(
  project: Project | null,
  phaseName: ProjectPhase["phaseName"] | "",
) {
  if (!project || !phaseName) return { start: null, end: null };

  const phaseMap: Record<ProjectPhase["phaseName"], ProjectPhase[] | undefined> = {
    Initiation: project.initiationPhase,
    Planing: project.planingPhase,
    Execution: project.executionPhase,
    Closure: project.closurePhase,
  };

  const phase = phaseMap[phaseName]?.[0];
  const start = toInputDate(phase?.startDate ?? null);
  const end = toInputDate(phase?.dueDate ?? null);
  return { start, end };
}

export interface BudgetSummary {
  totalHours: number;
  totalCost: number;
  assignedBudget: number;
  reserveBudget: number;
  percentageUsed: number;
  isOverBudget: boolean;
}

export function getTaskHours(task: Task): number {
  const taskHours = task.estimatedHours || 0;
  const subtaskHours = task.subtasks?.reduce((sum, st) => sum + (st.estimatedHours || 0), 0) || 0;
  return taskHours + subtaskHours;
}

export function getTaskCost(task: Task, rates: HourlyRate[] = DEFAULT_HOURLY_RATES): number {
  const taskHours = task.estimatedHours || 0;
  const taskRate = getHourlyRate(task.hourlyRateType, rates);
  const taskCost = taskHours * taskRate;

  const subtasksCost =
    task.subtasks?.reduce((sum, st) => {
      const stHours = st.estimatedHours || 0;
      const stRate = getHourlyRate(st.hourlyRateType, rates);
      return sum + stHours * stRate;
    }, 0) || 0;

  return taskCost + subtasksCost;
}

export function getTaskBudgetPercentage(
  task: Task,
  projectBudget: number | null,
  rates: HourlyRate[] = DEFAULT_HOURLY_RATES,
): number {
  if (!projectBudget || projectBudget === 0) return 0;
  const taskCost = getTaskCost(task, rates);
  return (taskCost / projectBudget) * 100;
}

export function getPhaseHoursSummary(
  project: Project,
  phaseName: ProjectPhase["phaseName"],
  rates: HourlyRate[] = DEFAULT_HOURLY_RATES,
): BudgetSummary {
  const tasks = project.Tasks.filter((t) => t.projectPhase === phaseName);

  const totalHours = tasks.reduce((sum, task) => sum + getTaskHours(task), 0);
  const totalCost = tasks.reduce((sum, task) => sum + getTaskCost(task, rates), 0);

  const projectBudget = project.budget || totalCost;
  const percentageUsed = projectBudget > 0 ? (totalCost / projectBudget) * 100 : 0;
  const isOverBudget = totalCost > projectBudget;

  return {
    totalHours,
    totalCost,
    assignedBudget: totalCost,
    reserveBudget: Math.max(projectBudget - totalCost, 0),
    percentageUsed,
    isOverBudget,
  };
}

export function getProjectBudgetSummary(
  project: Project,
  rates: HourlyRate[] = DEFAULT_HOURLY_RATES,
): BudgetSummary {
  const allTasks = project.Tasks || [];

  const totalHours = allTasks.reduce((sum, task) => sum + getTaskHours(task), 0);
  const totalCost = allTasks.reduce((sum, task) => sum + getTaskCost(task, rates), 0);

  const projectBudget = project.budget || totalCost;
  const percentageUsed = projectBudget > 0 ? (totalCost / projectBudget) * 100 : 0;
  const isOverBudget = totalCost > projectBudget;

  return {
    totalHours,
    totalCost,
    assignedBudget: totalCost,
    reserveBudget: Math.max(projectBudget - totalCost, 0),
    percentageUsed,
    isOverBudget,
  };
}

export function getCurrentPhase(project: Project): ProjectPhase["phaseName"] | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const phases: Array<{ name: ProjectPhase["phaseName"]; phase: ProjectPhase[] }> = [
    { name: "Initiation", phase: project.initiationPhase },
    { name: "Planing", phase: project.planingPhase },
    { name: "Execution", phase: project.executionPhase },
    { name: "Closure", phase: project.closurePhase },
  ];

  for (const { name, phase } of phases) {
    const phaseStart = phase[0]?.startDate ? new Date(phase[0].startDate) : null;
    const phaseEnd = phase[0]?.dueDate ? new Date(phase[0].dueDate) : null;

    if (phaseStart && phaseEnd) {
      phaseStart.setHours(0, 0, 0, 0);
      phaseEnd.setHours(0, 0, 0, 0);

      if (today >= phaseStart && today <= phaseEnd) {
        return name;
      }
    }
  }

  if (project.initiationPhase[0]?.startDate) {
    const initStart = new Date(project.initiationPhase[0].startDate);
    initStart.setHours(0, 0, 0, 0);
    if (today < initStart) {
      return "Initiation";
    }
  }

  return "Closure";
}

export function isProjectOnTrack(project: Project): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentPhase = getCurrentPhase(project);
  if (!currentPhase) return false;

  const phases: Record<ProjectPhase["phaseName"], ProjectPhase[]> = {
    Initiation: project.initiationPhase,
    Planing: project.planingPhase,
    Execution: project.executionPhase,
    Closure: project.closurePhase,
  };

  const phase = phases[currentPhase]?.[0];
  if (!phase || !phase.dueDate) return true;

  const phaseEndDate = new Date(phase.dueDate);
  phaseEndDate.setHours(0, 0, 0, 0);

  return today <= phaseEndDate;
}
