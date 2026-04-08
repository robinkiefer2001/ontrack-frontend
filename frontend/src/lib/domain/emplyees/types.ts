import type { Project } from "../project/types";

export interface ProjectList {
    project: Project[];
}

export type Employee = {
    employeeID: number;
    profilePicture: ImageBitmap | null;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    position: string | null;
    department: string | null;
    projects: ProjectList[] | null;
}