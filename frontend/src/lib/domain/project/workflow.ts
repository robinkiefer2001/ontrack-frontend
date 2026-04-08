import type { HourlyRate, Project, Task } from "$lib/domain/project/types";
import { getTaskCost } from "$lib/domain/project/services";

export interface TeamMemberSummary {
  name: string;
  role: "ProjectManager" | "Member";
  tasks: Task[];
  totalHours: number;
  totalBudget: number;
  isOnTrack: boolean;
}

export function getAssignedBudget(project: Project, rates: HourlyRate[]): number {
  return (project.Tasks || []).reduce((sum, task) => sum + getTaskCost(task, rates), 0);
}

export function getTeamMembers(project: Project, rates: HourlyRate[]): TeamMemberSummary[] {
  const members: Record<string, TeamMemberSummary> = {};

  if (project.projectManager && project.projectManager.trim()) {
    const pmName = project.projectManager.trim();
    members[pmName] = {
      name: pmName,
      role: "ProjectManager",
      tasks: [],
      totalHours: 0,
      totalBudget: 0,
      isOnTrack: true,
    };
  }

  (project.Tasks || []).forEach((task) => {
    const memberName = (task.assignedTo || "Unassigned").trim();
    if (!members[memberName]) {
      members[memberName] = {
        name: memberName,
        role: "Member",
        tasks: [],
        totalHours: 0,
        totalBudget: 0,
        isOnTrack: true,
      };
    }

    members[memberName].tasks.push(task);

    const taskHours = task.estimatedHours || 0;
    const subtaskHours = (task.subtasks || []).reduce((sum, st) => sum + (st.estimatedHours || 0), 0);
    members[memberName].totalHours += taskHours + subtaskHours;

    members[memberName].totalBudget += getTaskCost(task, rates);

    const today = new Date();
    const taskDueDate = task.dueDate ? new Date(task.dueDate) : null;
    if (task.status !== "Done" && taskDueDate && today > taskDueDate) {
      members[memberName].isOnTrack = false;
    }
  });

  return Object.values(members).sort((a, b) => {
    if (a.role === "ProjectManager" && b.role !== "ProjectManager") return -1;
    if (a.role !== "ProjectManager" && b.role === "ProjectManager") return 1;
    return a.name.localeCompare(b.name);
  });
}
