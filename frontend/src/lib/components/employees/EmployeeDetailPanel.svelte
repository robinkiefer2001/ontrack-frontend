<script lang="ts">
	import { getUserInitials } from "$lib/modules/user/store";
	import { t } from "$lib/language";
	import type { CompanyEmployee, RoleName } from "$lib/api";
	import type { EmployeeWorkload, EmployeeAssignment } from "$lib/modules/employees/business";
	import type { Project } from "$lib/modules/projects/contracts";

	let {
		workload,
		companyEmployee,
		canManageUsers,
		assignmentsByProject,
		unassignedProjects,
		expandedProjects,
		showAssignModal = $bindable(false),
		assignSearch = $bindable(""),
		emailCopied = $bindable(false),
		onEdit,
		onDelete,
		onToggleProject,
		onAssignToProject,
		onRemoveFromProject,
		onCopyEmail,
		getRoleLabel,
	}: {
		workload: EmployeeWorkload;
		companyEmployee: CompanyEmployee | undefined;
		canManageUsers: boolean;
		assignmentsByProject: { projectTitle: string; projectID: number | null; assignments: EmployeeAssignment[] }[];
		unassignedProjects: Project[];
		expandedProjects: Set<string>;
		showAssignModal: boolean;
		assignSearch: string;
		emailCopied: boolean;
		onEdit: (emp: CompanyEmployee) => void;
		onDelete: (emp: CompanyEmployee) => void;
		onToggleProject: (title: string) => void;
		onAssignToProject: (project: Project) => void;
		onRemoveFromProject: (title: string) => void;
		onCopyEmail: (email: string) => void;
		getRoleLabel: (name: RoleName) => string;
	} = $props();

	let emp = $derived(workload.employee);

	function formatDate(date: Date | null): string {
		if (!date) return "–";
		const d = new Date(date);
		return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case "Done": return "bg-green-100 text-green-700";
			case "In Progress": return "bg-blue-100 text-blue-700";
			case "To Do": return "bg-yellow-100 text-yellow-700";
			default: return "bg-gray-100 text-gray-600";
		}
	}

	function getStatusLabel(status: string): string {
		switch (status) {
			case "Done": return $t.taskStatus.done;
			case "In Progress": return $t.taskStatus.inProgress;
			case "To Do": return $t.taskStatus.toDo;
			case "Pending": return $t.taskStatus.pending;
			default: return status;
		}
	}
</script>

<!-- Header -->
<div class="flex items-start justify-between">
	<div class="flex items-start gap-4">
		<div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-xl font-semibold text-blue-600">
			{getUserInitials(emp.firstName, emp.lastName)}
		</div>
		<div>
			<h2 class="text-xl font-semibold text-gray-900">{workload.fullName}</h2>
			<p class="mt-0.5 text-sm text-gray-500">{emp.jobTitle || "–"}</p>
			{#if companyEmployee}
				<span class="mt-1 inline-block rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">{getRoleLabel(companyEmployee.role)}</span>
			{/if}
		</div>
	</div>
	{#if canManageUsers && companyEmployee}
		<div class="flex gap-2">
			<button onclick={() => onEdit(companyEmployee)} class="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-200">
				{$t.common.edit}
			</button>
			<button onclick={() => onDelete(companyEmployee)} class="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100">
				{$t.common.delete}
			</button>
		</div>
	{/if}
</div>

<!-- Contact Info -->
<div class="mt-5">
	<h3 class="text-sm font-semibold uppercase tracking-[0.15em] text-gray-500">{$t.employees.contactInfo}</h3>
	<div class="mt-2 grid gap-3 sm:grid-cols-2">
		<div class="rounded-2xl bg-gray-50 p-4">
			<p class="text-xs uppercase tracking-[0.15em] text-gray-400">{$t.employees.email}</p>
			<p class="mt-1 text-sm font-medium text-gray-800">{emp.email}</p>
			<div class="mt-2 flex gap-2">
				<button
					onclick={() => onCopyEmail(emp.email)}
					class="rounded-lg bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-300"
				>
					{emailCopied ? $t.employees.copied : $t.employees.copyEmail}
				</button>
				<a
					href="mailto:{emp.email}"
					class="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-200"
				>
					{$t.employees.sendEmail}
				</a>
			</div>
		</div>
		<div class="rounded-2xl bg-gray-50 p-4">
			<p class="text-xs uppercase tracking-[0.15em] text-gray-400">{$t.employees.phone}</p>
			<p class="mt-1 text-sm font-medium text-gray-800">{emp.phone || "–"}</p>
		</div>
		<div class="rounded-2xl bg-gray-50 p-4">
			<p class="text-xs uppercase tracking-[0.15em] text-gray-400">{$t.employees.department}</p>
			<p class="mt-1 text-sm font-medium text-gray-800">{emp.department || "–"}</p>
		</div>
		<div class="rounded-2xl bg-gray-50 p-4">
			<p class="text-xs uppercase tracking-[0.15em] text-gray-400">{$t.employees.role}</p>
			<p class="mt-1 text-sm font-medium text-gray-800">{companyEmployee ? getRoleLabel(companyEmployee.role) : (emp.jobTitle || "–")}</p>
		</div>
	</div>
</div>

<!-- Workload Summary Stats -->
<div class="mt-5 grid grid-cols-3 gap-3">
	<div class="rounded-2xl border border-gray-200 p-3 text-center">
		<p class="text-2xl font-bold text-gray-900">{workload.totalTasks + workload.totalSubtasks}</p>
		<p class="text-xs text-gray-500">{$t.employees.assignedTasks}</p>
	</div>
	<div class="rounded-2xl border border-gray-200 p-3 text-center">
		<p class="text-2xl font-bold text-blue-700">{workload.totalHours}h</p>
		<p class="text-xs text-gray-500">{$t.employees.hoursAssigned}</p>
	</div>
	<div class="rounded-2xl border border-gray-200 p-3 text-center">
		<p class="text-2xl font-bold text-green-700">{workload.projectCount}</p>
		<p class="text-xs text-gray-500">{$t.employees.assignedProjects}</p>
	</div>
</div>

<!-- Team Assignment -->
<div class="mt-5">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-semibold uppercase tracking-[0.15em] text-gray-500">{$t.employees.teamAssignment}</h3>
		<button
			onclick={() => { showAssignModal = !showAssignModal; assignSearch = ""; }}
			class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
		>
			+ {$t.employees.assignToProject}
		</button>
	</div>

	{#if showAssignModal}
		<div class="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
			<input
				type="search"
				bind:value={assignSearch}
				placeholder="{$t.common.search} {$t.employees.availableProjects}..."
				class="mb-3 w-full rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm outline-none placeholder:text-gray-400 focus:border-blue-400"
			/>
			<div class="max-h-40 space-y-1.5 overflow-y-auto">
				{#each unassignedProjects.slice(0, 20) as project (project.projectID)}
					<button
						onclick={() => onAssignToProject(project)}
						class="flex w-full items-center justify-between rounded-xl border border-blue-100 bg-white px-3 py-2 text-left text-sm transition hover:bg-blue-100"
					>
						<span class="font-medium text-gray-900">{project.title}</span>
						<span class="text-xs text-gray-500">{project.projectManager}</span>
					</button>
				{/each}
				{#if unassignedProjects.length === 0}
					<p class="py-2 text-center text-sm text-gray-500">{$t.employees.noTasks}</p>
				{/if}
			</div>
		</div>
	{/if}

	{#if workload.projectNames.length > 0}
		<div class="mt-3 flex flex-wrap gap-2">
			{#each workload.projectNames as pName}
				<span class="group flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
					{pName}
					<button
						onclick={() => onRemoveFromProject(pName)}
						class="ml-0.5 hidden rounded-full text-blue-400 transition hover:text-red-600 group-hover:inline"
						title={$t.employees.removeFromProject}
					>✕</button>
				</span>
			{/each}
		</div>
	{:else}
		<p class="mt-3 text-sm text-gray-400">{$t.employees.noTasks}</p>
	{/if}
</div>

<!-- Task Drilldown -->
<div class="mt-5">
	<h3 class="text-sm font-semibold uppercase tracking-[0.15em] text-gray-500">{$t.employees.tasksDrilldown}</h3>

	{#if assignmentsByProject.length > 0}
		<div class="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
			{#each assignmentsByProject as group (group.projectTitle)}
				<div class="rounded-xl border border-gray-200">
					<button
						onclick={() => onToggleProject(group.projectTitle)}
						class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition hover:bg-gray-50"
					>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-semibold text-gray-900">{group.projectTitle}</p>
							<p class="text-xs text-gray-500">
								{group.assignments.length} {$t.employees.assignedTasks} ·
								{group.assignments.reduce((s, a) => s + (a.estimatedHours || 0), 0)}h
							</p>
						</div>
						<span class="text-gray-400">{expandedProjects.has(group.projectTitle) ? "−" : "+"}</span>
					</button>

					{#if expandedProjects.has(group.projectTitle)}
						<div class="border-t border-gray-100">
							{#each group.assignments as assignment (assignment.taskID + assignment.type)}
								<div class="flex items-center gap-3 border-b border-gray-50 px-4 py-2.5 last:border-b-0 {assignment.isOverdue ? 'bg-red-50' : ''}">
									<span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase {assignment.type === 'subtask' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}">
										{assignment.type === "subtask" ? $t.employees.subtask : $t.employees.task}
									</span>
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm text-gray-900">{assignment.taskTitle}</p>
										{#if assignment.parentTaskTitle}
											<p class="truncate text-xs text-gray-400">↳ {assignment.parentTaskTitle}</p>
										{/if}
									</div>
									<span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold {getStatusColor(assignment.status)}">
										{getStatusLabel(assignment.status)}
									</span>
									<span class="shrink-0 text-xs text-gray-500">{assignment.estimatedHours || 0}h</span>
									<span class="shrink-0 text-xs text-gray-400">{formatDate(assignment.dueDate)}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<p class="mt-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
			{$t.employees.noTasks}
		</p>
	{/if}
</div>
