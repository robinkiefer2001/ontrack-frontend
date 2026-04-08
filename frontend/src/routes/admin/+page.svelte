<script lang="ts">
	import { onMount } from "svelte";
	import type { HourlyRate } from "$lib/modules/projects/contracts";
	import {
		DEFAULT_HOURLY_RATES,
		loadHourlyRates,
		saveHourlyRates,
	} from "$lib/modules/projects/rates";
	import {
		addHourlyRate,
		deleteHourlyRate,
		setDefaultHourlyRate,
	} from "$lib/modules/admin/business";
	import { t, currentLanguage } from "$lib/language";
	import type { Permission, RoleDefinition, RoleName, CompanyEmployee } from "$lib/api";
	import {
		roles,
		employees,
		ensureRbac,
		updateRole,
		addEmployee as addEmployeeApi,
		updateEmployee as updateEmployeeApi,
		deleteEmployee as deleteEmployeeApi,
		currentPermissions,
	} from "$lib/state/rbac/rbac.store";

	// ── Tabs ──────────────────────────────────────────────────────────────
	let activeTab = $state<"roles" | "users" | "rates" | "employment">("roles");

	// ── Permission guard ──────────────────────────────────────────────────
	let allowed = $derived($currentPermissions.has("admin.access"));

	// ── Hourly Rates state ────────────────────────────────────────────────
	let hourlyRates: HourlyRate[] = $state(loadHourlyRates());
	let newRateType = $state("");
	let newRateAmount = $state(0);
	let savedMessage = $state(false);

	function addRate() {
		hourlyRates = addHourlyRate(hourlyRates, newRateType, newRateAmount);
		newRateType = "";
		newRateAmount = 0;
	}

	function deleteRate(rateID: number) {
		hourlyRates = deleteHourlyRate(hourlyRates, rateID);
	}

	function setDefault(rateID: number) {
		hourlyRates = setDefaultHourlyRate(hourlyRates, rateID);
	}

	function saveRates() {
		saveHourlyRates(hourlyRates);
		savedMessage = true;
		setTimeout(() => { savedMessage = false; }, 3000);
	}

	function resetToDefaults() {
		hourlyRates = DEFAULT_HOURLY_RATES;
		saveHourlyRates(hourlyRates);
		savedMessage = true;
		setTimeout(() => { savedMessage = false; }, 3000);
	}

	// ── RBAC Roles state ─────────────────────────────────────────────────
	let editingRole = $state<RoleDefinition | null>(null);
	let editPerms = $state<Set<Permission>>(new Set());

	const ALL_PERMISSIONS: Permission[] = [
		"projects.create", "projects.edit", "projects.delete", "projects.view", "projects.assign_team",
		"tasks.create", "tasks.edit", "tasks.delete", "tasks.view",
		"users.create", "users.edit", "users.delete", "users.view",
		"customers.create", "customers.edit", "customers.delete", "customers.view",
		"roles.manage", "rates.manage", "employment.manage", "admin.access",
	];

	const ROLE_NAMES: RoleName[] = ["Admin", "ProjectManager", "TeamLead", "Developer", "Viewer"];

	function getRoleLabel(name: RoleName): string {
		const map: Record<RoleName, keyof typeof $t.admin> = {
			Admin: "roleAdmin",
			ProjectManager: "roleProjectManager",
			TeamLead: "roleTeamLead",
			Developer: "roleDeveloper",
			Viewer: "roleViewer",
		};
		return $t.admin[map[name]] as string;
	}

	function getPermLabel(perm: Permission): string {
		const map: Record<Permission, keyof typeof $t.admin> = {
			"projects.create": "permProjectsCreate",
			"projects.edit": "permProjectsEdit",
			"projects.delete": "permProjectsDelete",
			"projects.view": "permProjectsView",
			"projects.assign_team": "permProjectsAssignTeam",
			"tasks.create": "permTasksCreate",
			"tasks.edit": "permTasksEdit",
			"tasks.delete": "permTasksDelete",
			"tasks.view": "permTasksView",
			"users.create": "permUsersCreate",
			"users.edit": "permUsersEdit",
			"users.delete": "permUsersDelete",
			"users.view": "permUsersView",
			"customers.create": "permCustomersCreate",
			"customers.edit": "permCustomersEdit",
			"customers.delete": "permCustomersDelete",
			"customers.view": "permCustomersView",
			"roles.manage": "permRolesManage",
			"rates.manage": "permRatesManage",
			"employment.manage": "permEmploymentManage",
			"admin.access": "permAdminAccess",
		};
		return $t.admin[map[perm]] as string;
	}

	function openRoleEditor(role: RoleDefinition) {
		editingRole = { ...role };
		editPerms = new Set(role.permissions);
	}

	function togglePerm(perm: Permission) {
		const next = new Set(editPerms);
		if (next.has(perm)) next.delete(perm);
		else next.add(perm);
		editPerms = next;
	}

	async function saveEditingRole() {
		if (!editingRole) return;
		const updated: RoleDefinition = { name: editingRole.name, permissions: Array.from(editPerms) };
		await updateRole(updated);
		editingRole = null;
	}

	// ── User Management state ────────────────────────────────────────────
	let showUserForm = $state(false);
	let editingEmployee = $state<CompanyEmployee | null>(null);
	let userForm = $state({
		firstName: "",
		lastName: "",
		email: "",
		phone: "",
		department: "",
		jobTitle: "",
		role: "Developer" as RoleName,
	});
	let userMessage = $state("");

	function resetUserForm() {
		userForm = { firstName: "", lastName: "", email: "", phone: "", department: "", jobTitle: "", role: "Developer" };
		editingEmployee = null;
		showUserForm = false;
	}

	function openAddUser() {
		resetUserForm();
		showUserForm = true;
	}

	function openEditUser(emp: CompanyEmployee) {
		editingEmployee = emp;
		userForm = {
			firstName: emp.firstName,
			lastName: emp.lastName,
			email: emp.email,
			phone: emp.phone ?? "",
			department: emp.department ?? "",
			jobTitle: emp.jobTitle ?? "",
			role: emp.role,
		};
		showUserForm = true;
	}

	async function submitUser() {
		if (!userForm.firstName.trim() || !userForm.lastName.trim() || !userForm.email.trim()) return;

		if (editingEmployee) {
			await updateEmployeeApi(editingEmployee.employeeID, {
				firstName: userForm.firstName.trim(),
				lastName: userForm.lastName.trim(),
				email: userForm.email.trim(),
				phone: userForm.phone.trim(),
				department: userForm.department.trim(),
				jobTitle: userForm.jobTitle.trim(),
				role: userForm.role,
			});
			userMessage = $t.admin.userUpdated;
		} else {
			await addEmployeeApi({
				firstName: userForm.firstName.trim(),
				lastName: userForm.lastName.trim(),
				email: userForm.email.trim(),
				phone: userForm.phone.trim(),
				department: userForm.department.trim(),
				jobTitle: userForm.jobTitle.trim(),
				role: userForm.role,
				customerID: 0,
			});
			userMessage = $t.admin.userAdded;
		}
		resetUserForm();
		setTimeout(() => { userMessage = ""; }, 3000);
	}

	async function confirmDeleteUser(emp: CompanyEmployee) {
		if (!confirm($t.admin.confirmDelete)) return;
		await deleteEmployeeApi(emp.employeeID);
		userMessage = $t.admin.userDeleted;
		setTimeout(() => { userMessage = ""; }, 3000);
	}

	// ── Employment Settings state ────────────────────────────────────────
	let employmentEdits = $state(new Map<number, { pct: number; hpw: number }>());
	let employmentSaved = $state(false);

	function updateEmploymentEdit(id: number, pct: number, hpw: number) {
		const next = new Map(employmentEdits);
		next.set(id, { pct, hpw });
		employmentEdits = next;
	}

	async function saveEmploymentSettings() {
		for (const [id, edit] of employmentEdits) {
			await updateEmployeeApi(id, {
				employmentPercent: edit.pct,
				defaultHoursPerWeek: edit.hpw,
			});
		}
		employmentEdits = new Map();
		employmentSaved = true;
		setTimeout(() => { employmentSaved = false; }, 3000);
	}

	onMount(() => {
		ensureRbac();
	});
</script>

<div class="min-h-screen bg-gray-50">
	<div class="mx-auto max-w-7xl px-6 py-8">

		{#if !allowed}
			<div class="rounded-3xl border border-red-200 bg-red-50 p-10 text-center">
				<h2 class="text-2xl font-bold text-red-700">{$t.admin.accessDenied}</h2>
				<p class="mt-2 text-sm text-red-600">{$t.admin.accessDeniedMessage}</p>
			</div>
		{:else}

			<!-- Header -->
			<section class="overflow-hidden rounded-4xl border border-gray-200 bg-white shadow-sm">
				<div class="p-6 lg:p-8">
					<p class="text-sm uppercase tracking-[0.24em] text-blue-600">{$t.nav.admin}</p>
					<h1 class="mt-2 text-3xl font-bold tracking-tight text-gray-900">{$t.admin.title}</h1>
				</div>
			</section>

			{#if savedMessage || userMessage}
				<div class="mt-4 rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-medium text-green-700">
					{savedMessage ? `${$t.common.save} ✓` : userMessage}
				</div>
			{/if}

			<!-- Tab Bar -->
			<div class="mt-6 flex gap-1 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
				<button onclick={() => (activeTab = "roles")} class="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition {activeTab === 'roles' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}">
					{$t.admin.rbacTitle}
				</button>
				<button onclick={() => (activeTab = "users")} class="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition {activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}">
					{$t.admin.userManagement}
				</button>
				<button onclick={() => (activeTab = "employment")} class="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition {activeTab === 'employment' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}">
					{$t.admin.employmentSettings}
				</button>
				<button onclick={() => (activeTab = "rates")} class="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition {activeTab === 'rates' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}">
					{$t.settings.hourlyRatesTitle}
				</button>
			</div>

			<!-- ═══════════════════════════════════════════════════════════════ -->
			<!-- ROLES TAB                                                      -->
			<!-- ═══════════════════════════════════════════════════════════════ -->
			{#if activeTab === "roles"}
				<section class="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
					<!-- Role list -->
					<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
						<h2 class="text-xl font-semibold text-gray-900">{$t.admin.roles}</h2>
						<p class="mt-1 text-sm text-gray-500">{$t.admin.rbacDescription}</p>

						<div class="mt-5 space-y-2">
							{#each $roles as role (role.name)}
								{@const active = editingRole?.name === role.name}
								<button
									onclick={() => openRoleEditor(role)}
									class="flex w-full items-center justify-between rounded-2xl border p-4 text-left transition {active ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'}"
								>
									<div>
										<p class="text-base font-semibold text-gray-900">{getRoleLabel(role.name)}</p>
										<p class="mt-0.5 text-sm text-gray-500">{role.permissions.length} {$t.admin.permissionCount}</p>
									</div>
									<span class="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">{role.name}</span>
								</button>
							{/each}
						</div>
					</article>

					<!-- Permission editor -->
					<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
						{#if editingRole}
							<div class="flex items-center justify-between">
								<h2 class="text-xl font-semibold text-gray-900">{$t.admin.editRole}: {getRoleLabel(editingRole.name)}</h2>
								<button
									onclick={saveEditingRole}
									class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
								>
									{$t.admin.saveRole}
								</button>
							</div>

							<div class="mt-5 space-y-1">
								{#each ALL_PERMISSIONS as perm}
									{@const checked = editPerms.has(perm)}
									<label class="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-gray-50">
										<input
											type="checkbox"
											checked={checked}
											onchange={() => togglePerm(perm)}
											class="h-4 w-4 rounded border-gray-300 text-blue-600 accent-blue-600"
										/>
										<span class="text-sm text-gray-800">{getPermLabel(perm)}</span>
										<span class="ml-auto text-xs text-gray-400">{perm}</span>
									</label>
								{/each}
							</div>
						{:else}
							<div class="flex min-h-60 items-center justify-center text-gray-400">
								{$t.admin.editRole}
							</div>
						{/if}
					</article>
				</section>
			{/if}

			<!-- ═══════════════════════════════════════════════════════════════ -->
			<!-- USERS TAB                                                      -->
			<!-- ═══════════════════════════════════════════════════════════════ -->
			{#if activeTab === "users"}
				<section class="mt-6">
					<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
						<div class="flex items-center justify-between">
							<div>
								<h2 class="text-xl font-semibold text-gray-900">{$t.admin.userManagement}</h2>
								<p class="mt-1 text-sm text-gray-500">{$t.admin.userManagementDescription}</p>
							</div>
							<button
								onclick={openAddUser}
								class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
							>
								+ {$t.admin.addUser}
							</button>
						</div>

						{#if showUserForm}
							<div class="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">
								<h3 class="text-base font-semibold text-gray-900">
									{editingEmployee ? $t.admin.editUser : $t.admin.addUser}
								</h3>
								<div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
									<div>
										<label for="admin-firstName" class="text-xs font-semibold uppercase text-gray-500">{$t.admin.firstName}</label>
										<input id="admin-firstName" type="text" bind:value={userForm.firstName} class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300" />
									</div>
									<div>
										<label for="admin-lastName" class="text-xs font-semibold uppercase text-gray-500">{$t.admin.lastName}</label>
										<input id="admin-lastName" type="text" bind:value={userForm.lastName} class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300" />
									</div>
									<div>
										<label for="admin-email" class="text-xs font-semibold uppercase text-gray-500">{$t.admin.email}</label>
										<input id="admin-email" type="email" bind:value={userForm.email} class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300" />
									</div>
									<div>
										<label for="admin-phone" class="text-xs font-semibold uppercase text-gray-500">{$t.admin.phone}</label>
										<input id="admin-phone" type="tel" bind:value={userForm.phone} class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300" />
									</div>
									<div>
										<label for="admin-department" class="text-xs font-semibold uppercase text-gray-500">{$t.admin.department}</label>
										<input id="admin-department" type="text" bind:value={userForm.department} class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300" />
									</div>
									<div>
										<label for="admin-jobTitle" class="text-xs font-semibold uppercase text-gray-500">{$t.admin.jobTitle}</label>
										<input id="admin-jobTitle" type="text" bind:value={userForm.jobTitle} class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300" />
									</div>
									<div>
										<label for="admin-role" class="text-xs font-semibold uppercase text-gray-500">{$t.admin.role}</label>
										<select id="admin-role" bind:value={userForm.role} class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300">
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
									<button onclick={resetUserForm} class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
										{$t.common.cancel}
									</button>
								</div>
							</div>
						{/if}

						<!-- Employee table -->
						<div class="mt-5 overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-gray-200 text-left">
										<th class="px-3 py-3 font-semibold text-gray-700">{$t.admin.firstName}</th>
										<th class="px-3 py-3 font-semibold text-gray-700">{$t.admin.lastName}</th>
										<th class="px-3 py-3 font-semibold text-gray-700">{$t.admin.email}</th>
										<th class="px-3 py-3 font-semibold text-gray-700">{$t.admin.department}</th>
										<th class="px-3 py-3 font-semibold text-gray-700">{$t.admin.jobTitle}</th>
										<th class="px-3 py-3 font-semibold text-gray-700">{$t.admin.role}</th>
										<th class="px-3 py-3 text-right font-semibold text-gray-700">{$t.common.actions}</th>
									</tr>
								</thead>
								<tbody>
									{#each $employees as emp (emp.employeeID)}
										<tr class="border-b border-gray-100 hover:bg-gray-50">
											<td class="px-3 py-3 text-gray-900">{emp.firstName}</td>
											<td class="px-3 py-3 text-gray-900">{emp.lastName}</td>
											<td class="px-3 py-3 text-gray-600">{emp.email}</td>
											<td class="px-3 py-3 text-gray-600">{emp.department ?? "–"}</td>
											<td class="px-3 py-3 text-gray-600">{emp.jobTitle ?? "–"}</td>
											<td class="px-3 py-3">
												<span class="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">{getRoleLabel(emp.role)}</span>
											</td>
											<td class="px-3 py-3 text-right">
												<button onclick={() => openEditUser(emp)} class="mr-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-200">
													{$t.common.edit}
												</button>
												<button onclick={() => confirmDeleteUser(emp)} class="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100">
													{$t.common.delete}
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</article>
				</section>
			{/if}

			<!-- ═══════════════════════════════════════════════════════════════ -->
			<!-- EMPLOYMENT TAB                                                 -->
			<!-- ═══════════════════════════════════════════════════════════════ -->
			{#if activeTab === "employment"}
				<section class="mt-6">
					<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
						<div class="flex items-center justify-between">
							<div>
								<h2 class="text-xl font-semibold text-gray-900">{$t.admin.employmentSettings}</h2>
								<p class="mt-1 text-sm text-gray-500">{$t.admin.employmentSettingsDesc}</p>
							</div>
							<button
								onclick={saveEmploymentSettings}
								class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
							>
								{$t.common.save}
							</button>
						</div>

						<div class="mt-5 overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-gray-200 text-left">
										<th class="px-3 py-3 font-semibold text-gray-700">{$t.admin.firstName}</th>
										<th class="px-3 py-3 font-semibold text-gray-700">{$t.admin.lastName}</th>
										<th class="px-3 py-3 font-semibold text-gray-700">{$t.admin.department}</th>
										<th class="px-3 py-3 font-semibold text-gray-700">{$t.admin.jobTitle}</th>
										<th class="px-3 py-3 text-center font-semibold text-gray-700">{$t.admin.employmentPercent}</th>
										<th class="px-3 py-3 text-center font-semibold text-gray-700">{$t.admin.hoursPerWeek}</th>
										<th class="px-3 py-3 text-center font-semibold text-gray-700">{$t.admin.effectiveHours}</th>
									</tr>
								</thead>
								<tbody>
									{#each $employees as emp, idx (emp.employeeID)}
										{@const pct = employmentEdits.get(emp.employeeID)?.pct ?? emp.employmentPercent ?? 100}
										{@const hpw = employmentEdits.get(emp.employeeID)?.hpw ?? emp.defaultHoursPerWeek ?? 42}
										{@const effective = Math.round((pct / 100) * hpw * 10) / 10}
										<tr class="border-b border-gray-100 hover:bg-gray-50">
											<td class="px-3 py-3 text-gray-900">{emp.firstName}</td>
											<td class="px-3 py-3 text-gray-900">{emp.lastName}</td>
											<td class="px-3 py-3 text-gray-600">{emp.department ?? "–"}</td>
											<td class="px-3 py-3 text-gray-600">{emp.jobTitle ?? "–"}</td>
											<td class="px-3 py-3 text-center">
												<input
													type="number" min="0" max="100" step="5"
													value={pct}
													onchange={(e) => updateEmploymentEdit(emp.employeeID, parseInt(e.currentTarget.value) || 100, hpw)}
													class="w-20 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-center text-sm outline-none focus:border-blue-300 focus:bg-white"
												/>
											</td>
											<td class="px-3 py-3 text-center">
												<input
													type="number" min="0" max="60" step="1"
													value={hpw}
													onchange={(e) => updateEmploymentEdit(emp.employeeID, pct, parseFloat(e.currentTarget.value) || 42)}
													class="w-20 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-center text-sm outline-none focus:border-blue-300 focus:bg-white"
												/>
											</td>
											<td class="px-3 py-3 text-center">
												<span class="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">{effective}h</span>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						{#if employmentSaved}
							<div class="mt-4 rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-medium text-green-700">
								{$t.common.save} ✓
							</div>
						{/if}
					</article>
				</section>
			{/if}

			<!-- ═══════════════════════════════════════════════════════════════ -->
			<!-- RATES TAB                                                      -->
			<!-- ═══════════════════════════════════════════════════════════════ -->
			{#if activeTab === "rates"}
				<section class="mt-6">
					<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
						<h2 class="text-2xl font-bold text-gray-900 mb-6">{$t.settings.hourlyRatesTitle}</h2>

						<div class="overflow-x-auto mb-8">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-gray-200">
										<th class="text-left py-3 px-4 font-semibold text-gray-700">{$t.settings.rateType}</th>
										<th class="text-left py-3 px-4 font-semibold text-gray-700">{$t.settings.ratePerHour}</th>
										<th class="text-center py-3 px-4 font-semibold text-gray-700">{$t.settings.defaultRate}</th>
										<th class="text-right py-3 px-4 font-semibold text-gray-700">{$t.common.actions}</th>
									</tr>
								</thead>
								<tbody>
									{#each hourlyRates as rate (rate.rateID)}
										<tr class="border-b border-gray-100 hover:bg-gray-50">
											<td class="py-3 px-4 font-medium text-gray-900">{rate.rateType}</td>
											<td class="py-3 px-4 text-gray-700">{rate.hourlyRate} CHF/h</td>
											<td class="py-3 px-4 text-center">
												<input type="radio" name="default-rate" class="accent-blue-600" checked={rate.isDefault} onchange={() => setDefault(rate.rateID)} />
											</td>
											<td class="py-3 px-4 text-right">
												<button
													class="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
													onclick={() => deleteRate(rate.rateID)}
													disabled={hourlyRates.length === 1}
												>
													{$t.common.delete}
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<div class="border-t border-gray-200 pt-6">
							<h3 class="text-lg font-bold text-gray-900 mb-4">{$t.settings.addRate}</h3>

							<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
								<div>
									<label for="admin-rateType" class="text-xs font-semibold uppercase text-gray-500">{$t.settings.rateType}</label>
									<input
										id="admin-rateType"
										type="text"
										class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
										bind:value={newRateType}
										placeholder={$currentLanguage === "de" ? "z.B. SystemEngineer" : "e.g. SystemEngineer"}
									/>
								</div>

								<div>
									<label for="admin-ratePerHour" class="text-xs font-semibold uppercase text-gray-500">{$t.settings.ratePerHour}</label>
									<input
										id="admin-ratePerHour"
										type="number"
										class="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
										bind:value={newRateAmount}
										placeholder="140"
										min="0"
										step="10"
									/>
								</div>
							</div>

							<button onclick={addRate} class="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-900">
								{$t.settings.addRate}
							</button>
						</div>
					</article>

					<div class="mt-4 flex justify-center gap-4">
						<button onclick={saveRates} class="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700">
							{$t.common.save}
						</button>
						<button onclick={resetToDefaults} class="rounded-lg border border-gray-200 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
							{$currentLanguage === "de" ? "Auf Standard zurücksetzen" : "Reset to Defaults"}
						</button>
					</div>
				</section>
			{/if}

		{/if}
	</div>
</div>
