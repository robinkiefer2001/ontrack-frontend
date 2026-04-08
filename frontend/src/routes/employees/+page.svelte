<script lang="ts">
	import { onMount } from "svelte";
	import { projectList } from "$lib/modules/employees/store";
	import {
		buildEmployeeWorkload,
		getUniqueDepartments,
		type EmployeeWorkload,
		type EmployeeAssignment,
	} from "$lib/modules/employees/business";
	import type { CustomerEmployee, Project } from "$lib/modules/projects/contracts";
	import { getUserInitials } from "$lib/modules/user/store";
	import { t } from "$lib/language";
	import type { CompanyEmployee, RoleName } from "$lib/api";
	import EmployeeDetailPanel from "$lib/components/employees/EmployeeDetailPanel.svelte";
	import {
		employees,
		ensureRbac,
		addEmployee as addEmployeeApi,
		updateEmployee as updateEmployeeApi,
		deleteEmployee as deleteEmployeeApi,
		currentPermissions,
	} from "$lib/state/rbac/rbac.store";

	let searchText = $state("");
	let departmentFilter = $state("all");
	let selectedEmployeeId = $state<number | null>(null);
	let expandedProjects = $state(new Set<string>());
	let emailCopied = $state(false);
	let showAssignModal = $state(false);
	let assignSearch = $state("");

	// ── Admin add/edit user ──────────────────────────────────────────────
	let canManageUsers = $derived($currentPermissions.has("users.create") || $currentPermissions.has("users.edit"));
	let showUserForm = $state(false);
	let editingEmployee = $state<CompanyEmployee | null>(null);
	let userForm = $state({ firstName: "", lastName: "", email: "", phone: "", department: "", jobTitle: "", role: "Developer" as RoleName });
	let userMessage = $state("");

	const ROLE_NAMES: RoleName[] = ["Admin", "ProjectManager", "TeamLead", "Developer", "Viewer"];
	function getRoleLabel(name: RoleName): string {
		const map: Record<RoleName, keyof typeof $t.admin> = { Admin: "roleAdmin", ProjectManager: "roleProjectManager", TeamLead: "roleTeamLead", Developer: "roleDeveloper", Viewer: "roleViewer" };
		return $t.admin[map[name]] as string;
	}

	function openAddUser() {
		editingEmployee = null;
		userForm = { firstName: "", lastName: "", email: "", phone: "", department: "", jobTitle: "", role: "Developer" };
		showUserForm = true;
	}

	function openEditUser(emp: CompanyEmployee) {
		editingEmployee = emp;
		userForm = { firstName: emp.firstName, lastName: emp.lastName, email: emp.email, phone: emp.phone ?? "", department: emp.department ?? "", jobTitle: emp.jobTitle ?? "", role: emp.role };
		showUserForm = true;
	}

	async function submitUser() {
		if (!userForm.firstName.trim() || !userForm.lastName.trim() || !userForm.email.trim()) return;
		if (editingEmployee) {
			await updateEmployeeApi(editingEmployee.employeeID, { ...userForm });
			userMessage = $t.admin.userUpdated;
		} else {
			await addEmployeeApi({ ...userForm, customerID: 0 });
			userMessage = $t.admin.userAdded;
		}
		showUserForm = false;
		editingEmployee = null;
		setTimeout(() => { userMessage = ""; }, 3000);
	}

	async function confirmDeleteUser(emp: CompanyEmployee) {
		if (!confirm($t.admin.confirmDelete)) return;
		await deleteEmployeeApi(emp.employeeID);
		if (selectedEmployeeId === emp.employeeID) selectedEmployeeId = null;
		userMessage = $t.admin.userDeleted;
		setTimeout(() => { userMessage = ""; }, 3000);
	}

	// ── Employee list from RBAC store ────────────────────────────────────
	let employeeList = $derived($employees as CustomerEmployee[]);

	let departments = $derived(getUniqueDepartments(employeeList));

	let employeeWorkloads: EmployeeWorkload[] = $derived.by(() => {
		return employeeList.map((emp) => buildEmployeeWorkload(emp, $projectList));
	});

	let filteredEmployees = $derived.by(() => {
		let result = employeeWorkloads;

		if (departmentFilter !== "all") {
			result = result.filter((ew) => ew.employee.department === departmentFilter);
		}

		const q = searchText.trim().toLowerCase();
		if (q) {
			result = result.filter((ew) =>
				[ew.fullName, ew.employee.email, ew.employee.phone, ew.employee.department, ew.employee.jobTitle]
					.filter(Boolean)
					.join(" ")
					.toLowerCase()
					.includes(q),
			);
		}

		return result;
	});

	let totalEmployees = $derived(employeeList.length);
	let totalDepartments = $derived(departments.length);
	let avgWorkloadHours = $derived.by(() => {
		if (employeeWorkloads.length === 0) return 0;
		const total = employeeWorkloads.reduce((sum, e) => sum + e.totalHours, 0);
		return total / employeeWorkloads.length;
	});
	let overloadedCount = $derived(employeeWorkloads.filter((e) => e.totalHours > 200).length);

	let selectedWorkload = $derived.by(() => {
		if (selectedEmployeeId == null) return null;
		return employeeWorkloads.find((ew) => ew.employee.employeeID === selectedEmployeeId) ?? null;
	});

	let assignmentsByProject = $derived.by(() => {
		if (!selectedWorkload) return [];
		const map = new Map<string, { projectTitle: string; projectID: number | null; assignments: EmployeeAssignment[] }>();
		for (const a of selectedWorkload.assignments) {
			const key = a.projectTitle;
			if (!map.has(key)) {
				map.set(key, { projectTitle: a.projectTitle, projectID: a.projectID, assignments: [] });
			}
			map.get(key)!.assignments.push(a);
		}
		return Array.from(map.values()).sort((a, b) => a.projectTitle.localeCompare(b.projectTitle));
	});

	let unassignedProjects = $derived.by(() => {
		if (!selectedWorkload) return [];
		const assignedIds = new Set(selectedWorkload.assignments.map((a) => a.projectID));
		const q = assignSearch.trim().toLowerCase();
		return $projectList.filter((p) => {
			if (assignedIds.has(p.projectID)) return false;
			if (q && !p.title.toLowerCase().includes(q)) return false;
			return true;
		});
	});

	function selectEmployee(emp: CustomerEmployee) {
		selectedEmployeeId = emp.employeeID;
		expandedProjects = new Set();
		showAssignModal = false;
	}

	function toggleProjectExpand(projectTitle: string) {
		const next = new Set(expandedProjects);
		if (next.has(projectTitle)) next.delete(projectTitle);
		else next.add(projectTitle);
		expandedProjects = next;
	}

	function copyEmail(email: string) {
		navigator.clipboard.writeText(email);
		emailCopied = true;
		setTimeout(() => (emailCopied = false), 2000);
	}

	function assignEmployeeToProject(project: Project) {
		if (!selectedWorkload) return;
		const emp = selectedWorkload.employee;
		const fullName = `${emp.firstName} ${emp.lastName}`.trim();

		projectList.update((projects) =>
			projects.map((p) => {
				if (p.projectID !== project.projectID) return p;
				if ((p.Tasks || []).length === 0) return p;
				const firstTask = p.Tasks[0];
				if (firstTask.assignedTo === fullName) return p;
				return {
					...p,
					Tasks: [
						{ ...firstTask, assignedTo: fullName },
						...p.Tasks.slice(1),
					],
				};
			}),
		);
		showAssignModal = false;
	}

	function removeEmployeeFromProject(projectTitle: string) {
		if (!selectedWorkload) return;
		const emp = selectedWorkload.employee;
		const fullName = `${emp.firstName} ${emp.lastName}`.trim();

		projectList.update((projects) =>
			projects.map((p) => {
				if (p.title !== projectTitle) return p;
				return {
					...p,
					Tasks: (p.Tasks || []).map((task) => ({
						...task,
						assignedTo: task.assignedTo === fullName ? "" : task.assignedTo,
						subtasks: (task.subtasks || []).map((sub) => ({
							...sub,
							assignedTo: sub.assignedTo === fullName ? "" : sub.assignedTo,
						})),
					})),
				};
			}),
		);
	}

	onMount(() => {
		ensureRbac();
	});
</script>

<div class="min-h-screen bg-gray-50 font-sans">
	<div class="mx-auto flex max-w-7xl flex-col gap-6 p-6">

		<!-- Header -->
		<section class="overflow-hidden rounded-4xl border border-gray-200 bg-white shadow-sm">
			<div class="flex items-start justify-between p-6 lg:p-8">
				<div>
					<p class="text-sm uppercase tracking-[0.24em] text-blue-600">{$t.nav.employees}</p>
					<h1 class="mt-2 text-3xl font-bold tracking-tight text-gray-900">{$t.employees.title}</h1>
					<p class="mt-1 text-sm text-gray-500">{filteredEmployees.length} / {totalEmployees}</p>
				</div>
				{#if canManageUsers}
					<button onclick={openAddUser} class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
						+ {$t.admin.addUser}
					</button>
				{/if}
			</div>
		</section>

		{#if userMessage}
			<div class="rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-medium text-green-700">{userMessage}</div>
		{/if}

		{#if showUserForm}
			<section class="rounded-3xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
				<h3 class="text-base font-semibold text-gray-900">{editingEmployee ? $t.admin.editUser : $t.admin.addUser}</h3>
				<div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<div>
						<label for="emp-firstName" class="text-xs font-semibold uppercase text-gray-500">{$t.admin.firstName}</label>
						<input id="emp-firstName" type="text" bind:value={userForm.firstName} class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300" />
					</div>
					<div>
						<label for="emp-lastName" class="text-xs font-semibold uppercase text-gray-500">{$t.admin.lastName}</label>
						<input id="emp-lastName" type="text" bind:value={userForm.lastName} class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300" />
					</div>
					<div>
						<label for="emp-email" class="text-xs font-semibold uppercase text-gray-500">{$t.admin.email}</label>
						<input id="emp-email" type="email" bind:value={userForm.email} class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300" />
					</div>
					<div>
						<label for="emp-phone" class="text-xs font-semibold uppercase text-gray-500">{$t.admin.phone}</label>
						<input id="emp-phone" type="tel" bind:value={userForm.phone} class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300" />
					</div>
					<div>
						<label for="emp-department" class="text-xs font-semibold uppercase text-gray-500">{$t.admin.department}</label>
						<input id="emp-department" type="text" bind:value={userForm.department} class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300" />
					</div>
					<div>
						<label for="emp-jobTitle" class="text-xs font-semibold uppercase text-gray-500">{$t.admin.jobTitle}</label>
						<input id="emp-jobTitle" type="text" bind:value={userForm.jobTitle} class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300" />
					</div>
					<div>
						<label for="emp-role" class="text-xs font-semibold uppercase text-gray-500">{$t.admin.role}</label>
						<select id="emp-role" bind:value={userForm.role} class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300">
							{#each ROLE_NAMES as rn}
								<option value={rn}>{getRoleLabel(rn)}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="mt-4 flex gap-3">
					<button onclick={submitUser} class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
						{editingEmployee ? $t.common.save : $t.common.add}
					</button>
					<button onclick={() => { showUserForm = false; editingEmployee = null; }} class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
						{$t.common.cancel}
					</button>
				</div>
			</section>
		{/if}

		<!-- KPI Cards -->
		<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
			<article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
				<p class="text-sm font-medium text-gray-500">{$t.employees.totalEmployees}</p>
				<p class="mt-2 text-4xl font-bold text-gray-900">{totalEmployees}</p>
			</article>
			<article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
				<p class="text-sm font-medium text-gray-500">{$t.employees.departments}</p>
				<p class="mt-2 text-4xl font-bold text-blue-700">{totalDepartments}</p>
			</article>
			<article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
				<p class="text-sm font-medium text-gray-500">{$t.employees.avgWorkload}</p>
				<p class="mt-2 text-4xl font-bold text-green-700">{avgWorkloadHours.toFixed(0)}h</p>
			</article>
			<article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
				<p class="text-sm font-medium text-gray-500">{$t.employees.overloaded}</p>
				<p class="mt-2 text-4xl font-bold" class:text-red-600={overloadedCount > 0} class:text-gray-900={overloadedCount === 0}>{overloadedCount}</p>
			</article>
		</section>

		<!-- Toolbar: Search + Department Filter -->
		<section class="flex flex-wrap items-center gap-3">
			<input
				type="search"
				placeholder={$t.common.search}
				bind:value={searchText}
				class="w-64 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 transition focus:border-blue-300 focus:bg-white shadow-sm"
			/>
			<select
				bind:value={departmentFilter}
				class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-300 shadow-sm"
			>
				<option value="all">{$t.employees.department} – {$t.common.select}</option>
				{#each departments as dept}
					<option value={dept}>{dept}</option>
				{/each}
			</select>
		</section>

		<!-- Main Grid: Table + Detail Panel -->
		<section class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">

			<!-- Employee List -->
			<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
				<h2 class="text-xl font-semibold text-gray-900">{$t.employees.title}</h2>

				{#if filteredEmployees.length > 0}
					<div class="mt-5 max-h-[calc(100vh-22rem)] space-y-2 overflow-y-auto pr-1">
						{#each filteredEmployees as ew (ew.employee.employeeID)}
							{@const active = selectedEmployeeId === ew.employee.employeeID}
							<button
								onclick={() => selectEmployee(ew.employee)}
								class={`w-full rounded-2xl border p-4 text-left transition ${active ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:border-blue-200 hover:bg-gray-50"}`}
							>
								<div class="flex items-start gap-3">
									<!-- Avatar -->
									<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
										{getUserInitials(ew.employee.firstName, ew.employee.lastName)}
									</div>
									<div class="min-w-0 flex-1">
										<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
											<div>
												<p class="text-base font-semibold text-gray-900">{ew.fullName}</p>
												<p class="mt-0.5 text-sm text-gray-500">{ew.employee.jobTitle || "–"} · {ew.employee.department || "–"}</p>
											</div>
											<div class="flex flex-wrap gap-1.5">
										{#if $employees.find((e) => e.employeeID === ew.employee.employeeID)}
											{@const compEmpItem = $employees.find((e) => e.employeeID === ew.employee.employeeID)}
											{#if compEmpItem}
												<span class="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">{getRoleLabel(compEmpItem.role)}</span>
											{/if}
												{/if}
												<span class="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
													{ew.totalTasks + ew.totalSubtasks} {$t.employees.assignedTasks}
												</span>
												<span class="rounded-full px-2.5 py-0.5 text-xs font-semibold {ew.isOnTrack ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
													{ew.isOnTrack ? $t.employees.onTrack : $t.employees.behind}
												</span>
											</div>
										</div>
										<!-- Workload bar -->
										<div class="mt-2.5">
											<div class="flex items-center justify-between text-xs text-gray-500">
												<span>{$t.employees.workload}: {ew.totalHours}h</span>
												<span>{ew.projectCount} {$t.employees.assignedProjects}</span>
											</div>
											<div class="mt-1 h-1.5 w-full rounded-full bg-gray-200">
												<div
													class="h-full rounded-full transition-all {Math.min((ew.totalHours / 300) * 100, 100) > 80 ? 'bg-red-500' : Math.min((ew.totalHours / 300) * 100, 100) > 50 ? 'bg-yellow-500' : 'bg-blue-500'}"
													style="width: {Math.min((ew.totalHours / 300) * 100, 100)}%"
												></div>
											</div>
										</div>
									</div>
								</div>
							</button>
						{/each}
					</div>
				{:else}
					<div class="mt-5 rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
						{$t.employees.noEmployees}
					</div>
				{/if}
			</article>

			<!-- Detail Panel -->
			<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
				{#if selectedWorkload}
					<EmployeeDetailPanel
						workload={selectedWorkload}
						companyEmployee={$employees.find((e) => e.employeeID === selectedWorkload.employee.employeeID)}
						{canManageUsers}
						{assignmentsByProject}
						{unassignedProjects}
						{expandedProjects}
						bind:showAssignModal
						bind:assignSearch
						bind:emailCopied
						onEdit={openEditUser}
						onDelete={confirmDeleteUser}
						onToggleProject={toggleProjectExpand}
						onAssignToProject={assignEmployeeToProject}
						onRemoveFromProject={removeEmployeeFromProject}
						onCopyEmail={copyEmail}
						{getRoleLabel}
					/>
				{:else}
					<div class="flex min-h-80 items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-gray-50 text-center text-gray-500">
						{$t.employees.selectEmployee}
					</div>
				{/if}
			</article>
		</section>
	</div>
</div>
