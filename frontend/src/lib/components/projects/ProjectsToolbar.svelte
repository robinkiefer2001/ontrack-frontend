<script lang="ts">
  import type { Project } from "$lib/modules/projects/contracts";
  import { createEventDispatcher } from "svelte";
  import { t } from "$lib/language";
  import {
    countProjects,
    getProjectBudgetSummary,
    isClosedProject,
  } from "$lib/modules/projects/business";
  import { toDateOrNull } from "$lib/utils/date";
  import { formatBudget, formatHours } from "$lib/utils/format";

  export let projects: Project[] = [];
  export let allProjects: Project[] = [];
  export let totalAllProjects: Project[] = [];
  export let selectedProject: Project | null = null;
  export let fullTextSearch = "";
  export let projectManagerFilter = "";
  export let customerFilter = "";
  export let projectManagers: string[] = [];
  export let customers: string[] = [];

  const dispatch = createEventDispatcher<{
    newProject: void;
    printProjectState: void;
    modifyProject: void;
    showCurrentProject: void;
  }>();

  $: totalProjects = countProjects(totalAllProjects);
  $: activeProjects = allProjects.filter(
    (project) => !isClosedProject(project),
  ).length;
  $: overdueProjects = allProjects.filter((project) => {
    const dueDate = toDateOrNull(project.dueDate);
    if (!dueDate || isClosedProject(project)) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    return dueDate < today;
  }).length;
  $: overBudgetProjects = allProjects.filter(
    (project) => !isClosedProject(project) && getProjectBudgetSummary(project).isOverBudget,
  ).length;
  $: totalBudget = allProjects.reduce(
    (sum, project) => sum + (project.budget || 0),
    0,
  );
  $: totalHours = allProjects.reduce(
    (sum, project) => sum + getProjectBudgetSummary(project).totalHours,
    0,
  );
</script>

<!-- Header -->
<section class="overflow-hidden rounded-4xl border border-gray-200 bg-white shadow-sm">
  <div class="flex items-start justify-between p-6 lg:p-8">
    <div>
      <p class="text-sm uppercase tracking-[0.24em] text-blue-600">{$t.projects.title}</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-gray-900">{$t.projects.title}</h1>
      <p class="mt-1 text-sm text-gray-500">{countProjects(projects)} / {totalProjects}</p>
    </div>
    <button
      class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
      on:click={() => dispatch("newProject")}
    >
      + {$t.projects.newProject}
    </button>
  </div>
</section>

<!-- KPI Cards -->
<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
  <article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
    <p class="text-sm font-medium text-gray-500">{$t.home.totalProjects}</p>
    <p class="mt-2 text-4xl font-bold text-gray-900">{totalProjects}</p>
  </article>
  <article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
    <p class="text-sm font-medium text-gray-500">{$t.home.activeProjects}</p>
    <p class="mt-2 text-4xl font-bold text-blue-700">{activeProjects}</p>
  </article>
  <article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm {overdueProjects > 0 ? 'border-red-200 bg-red-50/50' : ''}">
    <p class="text-sm font-medium text-gray-500">{$t.home.overdueProjects}</p>
    <p class="mt-2 text-4xl font-bold {overdueProjects > 0 ? 'text-red-600' : 'text-gray-900'}">{overdueProjects}</p>
  </article>
  <article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm {overBudgetProjects > 0 ? 'border-orange-200 bg-orange-50/50' : ''}">
    <p class="text-sm font-medium text-gray-500">{$t.home.overBudgetProjects}</p>
    <p class="mt-2 text-4xl font-bold {overBudgetProjects > 0 ? 'text-orange-600' : 'text-green-700'}">{overBudgetProjects}</p>
  </article>
  <article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
    <p class="text-sm font-medium text-gray-500">{$t.home.totalBudget}</p>
    <p class="mt-2 text-3xl font-bold text-gray-900">{formatBudget(totalBudget)}</p>
  </article>
  <article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
    <p class="text-sm font-medium text-gray-500">{$t.home.totalHours}</p>
    <p class="mt-2 text-3xl font-bold text-gray-900">{formatHours(totalHours)}</p>
  </article>
</section>

<!-- Toolbar: Actions + Filters -->
<section class="flex flex-wrap items-center gap-3">
  {#if selectedProject != null}
    <button
      class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
      on:click={() => dispatch("showCurrentProject")}
    >{$t.projects.showProject}</button>
    <button
      class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
      on:click={() => dispatch("printProjectState")}
    >{$t.projects.printProjectState}</button>
  {/if}
  <input
    type="search"
    placeholder={$t.projects.fullTextSearch}
    class="w-64 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 transition focus:border-blue-300 shadow-sm"
    bind:value={fullTextSearch}
  />
  <select
    class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-300 shadow-sm"
    bind:value={projectManagerFilter}
  >
    <option value="">{$t.projects.allProjectManagers}</option>
    {#each projectManagers as pm}
      <option value={pm}>{pm}</option>
    {/each}
  </select>
  <select
    class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-300 shadow-sm"
    bind:value={customerFilter}
  >
    <option value="">{$t.projects.allCustomers}</option>
    {#each customers as customer}
      <option value={customer}>{customer}</option>
    {/each}
  </select>
</section>
