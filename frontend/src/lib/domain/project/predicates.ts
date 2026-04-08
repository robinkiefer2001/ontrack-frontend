import type { Project } from "$lib/domain/project/types";

export function isClosedProject(project: Project): boolean {
  return project.projectstatus === "Closed" || project.projectstatus === "Cancelled";
}
