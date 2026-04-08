<script lang="ts">
	import { api } from "$lib/api";
	import type { Customer } from "$lib/domain/project/types";
	import { projectList } from "$lib/modules/projects/dataSource.mock";
	import { employees } from "$lib/state/rbac/rbac.store";
	import { currentPermissions } from "$lib/state/rbac/rbac.store";
	import { t } from "$lib/language";

	let searchText = $state("");
	let selectedCustomerId = $state<number | null>(null);
	let customers = $state<Customer[]>([]);

	// CRUD modal state
	let showModal = $state(false);
	let editingCustomer = $state<Customer | null>(null);
	let showDeleteConfirm = $state(false);
	let deletingCustomer = $state<Customer | null>(null);

	// Form fields
	let formCompanyName = $state("");
	let formContactName = $state("");
	let formEmail = $state("");
	let formPhone = $state("");
	let formZip = $state("");
	let formSaving = $state(false);

	// Permissions
	let canCreate = $derived($currentPermissions.has("customers.create"));
	let canEdit = $derived($currentPermissions.has("customers.edit"));
	let canDelete = $derived($currentPermissions.has("customers.delete"));

	// Load customers from API
	async function loadCustomers() {
		customers = await api.getCustomers();
	}

	$effect(() => { loadCustomers(); });

	type TeamMemberProfile = {
		fullName: string;
		department: string | null;
		jobTitle: string | null;
		email: string;
	};

	function getAssignedPeople(projectsForCustomer: typeof $projectList): string[] {
		const names = new Set<string>();
		for (const project of projectsForCustomer) {
			if (project.projectManager?.trim()) names.add(project.projectManager.trim());
			for (const task of project.Tasks || []) {
				if (task.assignedTo?.trim()) names.add(task.assignedTo.trim());
				for (const subtask of task.subtasks || []) {
					if (subtask.assignedTo?.trim()) names.add(subtask.assignedTo.trim());
				}
			}
		}
		return Array.from(names).sort((a, b) => a.localeCompare(b));
	}

	let internalTeamDirectory = $derived.by(() => {
		const map = new Map<string, TeamMemberProfile>();
		for (const emp of $employees) {
			const fullName = `${emp.firstName} ${emp.lastName}`.trim();
			if (!map.has(fullName)) {
				map.set(fullName, {
					fullName,
					department: emp.department,
					jobTitle: emp.jobTitle,
					email: emp.email,
				});
			}
		}
		return Array.from(map.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
	});

	let customerMetrics = $derived.by(() =>
		customers.map((customer) => {
			const projectsForCustomer = $projectList.filter((p) => p.customerID === customer.customerID);
			const assignedTeam = getAssignedPeople(projectsForCustomer);
			return {
				customer,
				employeeCount: assignedTeam.length,
				projectCount: projectsForCustomer.length,
				assignedTeam,
			};
		})
	);

	let filteredCustomers = $derived.by(() => {
		const q = searchText.trim().toLowerCase();
		if (!q) return customerMetrics;
		return customerMetrics.filter(({ customer }) =>
			[customer.companyName, customer.contactName, customer.email, customer.phone, String(customer.zip)]
				.join(" ").toLowerCase().includes(q)
		);
	});

	let totalCustomers = $derived(customers.length);
	let totalEmployees = $derived(internalTeamDirectory.length);
	let totalProjects = $derived($projectList.length);
	let avgProjectsPerCustomer = $derived(totalCustomers === 0 ? 0 : totalProjects / totalCustomers);

	let selectedCustomerData = $derived.by(() => {
		if (selectedCustomerId == null) return null;
		return customerMetrics.find(({ customer }) => customer.customerID === selectedCustomerId) ?? null;
	});

	let selectedCustomerEmployees = $derived.by(() => {
		if (!selectedCustomerData) return [];
		const assigned = new Set(selectedCustomerData.assignedTeam);
		return internalTeamDirectory.filter((e) => assigned.has(e.fullName));
	});

	let selectedCustomerProjects = $derived.by(() => {
		if (!selectedCustomerData) return [];
		return $projectList.filter((p) => p.customerID === selectedCustomerData.customer.customerID);
	});

	function selectCustomer(customer: Customer) {
		selectedCustomerId = customer.customerID;
	}

	// Modal helpers
	function openAddModal() {
		editingCustomer = null;
		formCompanyName = "";
		formContactName = "";
		formEmail = "";
		formPhone = "";
		formZip = "";
		showModal = true;
	}

	function openEditModal(customer: Customer) {
		editingCustomer = customer;
		formCompanyName = customer.companyName;
		formContactName = customer.contactName;
		formEmail = customer.email;
		formPhone = customer.phone;
		formZip = String(customer.zip);
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		editingCustomer = null;
	}

	async function saveCustomer() {
		formSaving = true;
		const data = {
			companyName: formCompanyName.trim(),
			contactName: formContactName.trim(),
			email: formEmail.trim(),
			phone: formPhone.trim(),
			zip: parseInt(formZip) || 0,
		};
		if (editingCustomer) {
			await api.updateCustomer(editingCustomer.customerID, data);
		} else {
			await api.addCustomer(data);
		}
		await loadCustomers();
		formSaving = false;
		closeModal();
	}

	function confirmDelete(customer: Customer) {
		deletingCustomer = customer;
		showDeleteConfirm = true;
	}

	async function executeDelete() {
		if (!deletingCustomer) return;
		await api.deleteCustomer(deletingCustomer.customerID);
		if (selectedCustomerId === deletingCustomer.customerID) selectedCustomerId = null;
		await loadCustomers();
		showDeleteConfirm = false;
		deletingCustomer = null;
	}
</script>

<div class="min-h-screen bg-gray-50 font-sans">
	<div class="mx-auto flex max-w-7xl flex-col gap-6 p-6">

		<!-- Header -->
		<section class="overflow-hidden rounded-4xl border border-gray-200 bg-white shadow-sm">
			<div class="flex flex-wrap items-center justify-between gap-4 p-6 lg:p-8">
				<div>
					<p class="text-sm uppercase tracking-[0.24em] text-blue-600">{$t.nav.customers}</p>
					<h1 class="mt-2 text-3xl font-bold tracking-tight text-gray-900">{$t.customers.title}</h1>
					<p class="mt-1 text-sm text-gray-500">{filteredCustomers.length} / {totalCustomers}</p>
				</div>
				{#if canCreate}
					<button onclick={openAddModal} class="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
						+ {$t.customers.addCustomer}
					</button>
				{/if}
			</div>
		</section>

		<!-- Stats -->
		<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
			<article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
				<p class="text-sm font-medium text-gray-500">{$t.customers.title}</p>
				<p class="mt-2 text-4xl font-bold text-gray-900">{totalCustomers}</p>
			</article>
			<article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
				<p class="text-sm font-medium text-gray-500">{$t.nav.employees}</p>
				<p class="mt-2 text-4xl font-bold text-blue-700">{totalEmployees}</p>
			</article>
			<article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
				<p class="text-sm font-medium text-gray-500">{$t.nav.projects}</p>
				<p class="mt-2 text-4xl font-bold text-green-700">{totalProjects}</p>
			</article>
			<article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
				<p class="text-sm font-medium text-gray-500">Ø {$t.nav.projects}</p>
				<p class="mt-2 text-4xl font-bold text-gray-900">{avgProjectsPerCustomer.toFixed(1)}</p>
			</article>
		</section>

		<!-- Main content -->
		<section class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
			<!-- Customer list -->
			<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<h2 class="text-xl font-semibold text-gray-900">{$t.customers.title}</h2>
					<input
						type="search"
						placeholder={$t.common.search}
						bind:value={searchText}
						class="w-56 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 transition focus:border-blue-300 focus:bg-white"
					/>
				</div>

				{#if filteredCustomers.length > 0}
					<div class="mt-5 max-h-160 space-y-2 overflow-y-auto pr-1">
						{#each filteredCustomers as row (row.customer.customerID)}
							{@const active = selectedCustomerId === row.customer.customerID}
							<button
								onclick={() => selectCustomer(row.customer)}
								class={`w-full rounded-2xl border p-4 text-left transition ${active ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:border-blue-200 hover:bg-gray-50"}`}
							>
								<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div>
										<p class="text-base font-semibold text-gray-900">{row.customer.companyName}</p>
										<p class="mt-1 text-sm text-gray-500">{row.customer.contactName}</p>
									</div>
									<div class="flex flex-wrap gap-2">
										<span class="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
											{row.employeeCount} {$t.nav.employees}
										</span>
										<span class="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
											{row.projectCount} {$t.nav.projects}
										</span>
									</div>
								</div>
								<div class="mt-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
									<p class="truncate">{row.customer.email}</p>
									<p>{row.customer.phone}</p>
								</div>
							</button>
						{/each}
					</div>
				{:else}
					<div class="mt-5 rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
						{$t.customers.noCustomers}
					</div>
				{/if}
			</article>

			<!-- Detail panel -->
			<article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
				{#if selectedCustomerData}
					<div>
						<div class="flex items-start justify-between gap-3">
							<div>
								<h2 class="text-xl font-semibold text-gray-900">{selectedCustomerData.customer.companyName}</h2>
								<p class="mt-1 text-sm text-gray-500">{$t.customers.contactPerson}: {selectedCustomerData.customer.contactName}</p>
							</div>
							<div class="flex gap-2">
								{#if canEdit}
									<button onclick={() => openEditModal(selectedCustomerData.customer)} class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
										{$t.common.edit}
									</button>
								{/if}
								{#if canDelete}
									<button onclick={() => confirmDelete(selectedCustomerData.customer)} class="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50">
										{$t.common.delete}
									</button>
								{/if}
							</div>
						</div>

						<div class="mt-4 grid gap-3 sm:grid-cols-2">
							<div class="rounded-2xl bg-gray-50 p-4">
								<p class="text-xs uppercase tracking-[0.15em] text-gray-400">{$t.customers.email}</p>
								<p class="mt-1 text-sm font-medium text-gray-800">{selectedCustomerData.customer.email}</p>
							</div>
							<div class="rounded-2xl bg-gray-50 p-4">
								<p class="text-xs uppercase tracking-[0.15em] text-gray-400">{$t.customers.phone}</p>
								<p class="mt-1 text-sm font-medium text-gray-800">{selectedCustomerData.customer.phone}</p>
							</div>
							<div class="rounded-2xl bg-gray-50 p-4">
								<p class="text-xs uppercase tracking-[0.15em] text-gray-400">{$t.customers.zip}</p>
								<p class="mt-1 text-sm font-medium text-gray-800">{selectedCustomerData.customer.zip}</p>
							</div>
							<div class="rounded-2xl bg-gray-50 p-4">
								<p class="text-xs uppercase tracking-[0.15em] text-gray-400">{$t.nav.projects}</p>
								<p class="mt-1 text-sm font-medium text-gray-800">{selectedCustomerData.projectCount}</p>
							</div>
						</div>

						<!-- Assigned team -->
						<div class="mt-5">
							<h3 class="text-sm font-semibold uppercase tracking-[0.15em] text-gray-500">{$t.customers.assignedTeam}</h3>
							<div class="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
								{#each selectedCustomerEmployees as employee (employee.fullName)}
									<div class="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
										<p class="text-sm font-medium text-gray-900">{employee.fullName}</p>
										<p class="text-xs text-gray-500">{employee.department || "-"} · {employee.jobTitle || "-"}</p>
									</div>
								{/each}
								{#if selectedCustomerEmployees.length === 0}
									<p class="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-sm text-gray-500">{$t.customers.noAssignedEmployees}</p>
								{/if}
							</div>
						</div>

						<!-- Projects -->
						<div class="mt-5">
							<h3 class="text-sm font-semibold uppercase tracking-[0.15em] text-gray-500">{$t.nav.projects}</h3>
							<div class="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
								{#each selectedCustomerProjects as project (project.projectID)}
									<div class="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
										<p class="text-sm font-medium text-gray-900">{project.title}</p>
										<p class="text-xs text-gray-500">{project.projectManager}</p>
									</div>
								{/each}
								{#if selectedCustomerProjects.length === 0}
									<p class="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-sm text-gray-500">{$t.home.noProjects}</p>
								{/if}
							</div>
						</div>
					</div>
				{:else}
					<div class="flex min-h-80 items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-gray-50 text-center text-gray-500">
						{$t.customers.selectCustomer}
					</div>
				{/if}
			</article>
		</section>
	</div>
</div>

<!-- Add / Edit Modal -->
{#if showModal}
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog">
	<div class="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-6 shadow-xl">
		<h2 class="text-xl font-semibold text-gray-900">
			{editingCustomer ? $t.customers.editCustomer : $t.customers.addCustomer}
		</h2>

		<form onsubmit={(e) => { e.preventDefault(); saveCustomer(); }} class="mt-5 space-y-4">
			<div>
				<label for="companyName" class="block text-sm font-medium text-gray-700">{$t.customers.companyName}</label>
				<input id="companyName" type="text" required bind:value={formCompanyName}
					class="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-300 focus:bg-white" />
			</div>
			<div>
				<label for="contactName" class="block text-sm font-medium text-gray-700">{$t.customers.contactPerson}</label>
				<input id="contactName" type="text" required bind:value={formContactName}
					class="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-300 focus:bg-white" />
			</div>
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label for="email" class="block text-sm font-medium text-gray-700">{$t.customers.email}</label>
					<input id="email" type="email" required bind:value={formEmail}
						class="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-300 focus:bg-white" />
				</div>
				<div>
					<label for="phone" class="block text-sm font-medium text-gray-700">{$t.customers.phone}</label>
					<input id="phone" type="tel" required bind:value={formPhone}
						class="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-300 focus:bg-white" />
				</div>
			</div>
			<div>
				<label for="zip" class="block text-sm font-medium text-gray-700">{$t.customers.zip}</label>
				<input id="zip" type="text" required bind:value={formZip}
					class="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-300 focus:bg-white" />
			</div>

			<div class="flex justify-end gap-3 pt-2">
				<button type="button" onclick={closeModal} class="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
					{$t.common.cancel}
				</button>
				<button type="submit" disabled={formSaving} class="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">
					{formSaving ? "..." : $t.common.save}
				</button>
			</div>
		</form>
	</div>
</div>
{/if}

<!-- Delete Confirmation -->
{#if showDeleteConfirm && deletingCustomer}
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog">
	<div class="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-xl">
		<h2 class="text-lg font-semibold text-gray-900">{$t.customers.deleteCustomer}</h2>
		<p class="mt-2 text-sm text-gray-600">{$t.customers.deleteConfirm}</p>
		<p class="mt-2 text-sm font-medium text-gray-900">{deletingCustomer.companyName}</p>
		<div class="mt-5 flex justify-end gap-3">
			<button onclick={() => { showDeleteConfirm = false; deletingCustomer = null; }} class="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
				{$t.common.cancel}
			</button>
			<button onclick={executeDelete} class="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700">
				{$t.common.delete}
			</button>
		</div>
	</div>
</div>
{/if}
