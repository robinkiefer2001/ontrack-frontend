export {
  countProjects,
  getPhaseRange,
  getTaskHours,
  getTaskCost,
  getTaskBudgetPercentage,
  getPhaseHoursSummary,
  getProjectBudgetSummary,
  getCurrentPhase,
  isProjectOnTrack,
  type BudgetSummary,
} from "$lib/domain/project/services";

export { isClosedProject } from "$lib/domain/project/predicates";
export {
  getAssignedBudget,
  getTeamMembers,
  type TeamMemberSummary,
} from "$lib/domain/project/workflow";
