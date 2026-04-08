<script lang="ts">
  import type { Project, HourlyRate } from "$lib/modules/projects/contracts";
  import { TaskRow } from "$lib/modules/projects/ui";
  import { ProjectDetailsOverview, ProjectTeamMembers } from "$lib/modules/projects/ui";
  import { t } from "$lib/language";

  export let selectedProject: Project | null = null;
  export let hourlyRates: HourlyRate[] = [];
  export let closeCurrentProject: () => void;
</script>

<div class="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
  <div class="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
    <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">{selectedProject?.title ?? "Project Details"}</h1>
        <p class="text-sm text-gray-500 mt-1">{selectedProject?.customerName ?? ""}</p>
      </div>
      <button class="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-200" on:click={closeCurrentProject} aria-label="Close project view">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>

  <div class="max-w-7xl mx-auto px-6 py-8">
    {#if selectedProject}
      <ProjectDetailsOverview project={selectedProject} {hourlyRates} />
      <ProjectTeamMembers project={selectedProject} {hourlyRates} />
    {/if}

    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-900">{$t.projects.tasks} ({selectedProject?.Tasks.length || 0})</h2>
      </div>

      {#if selectedProject && selectedProject.Tasks.length > 0}
        <div class="overflow-x-auto">
          <table class="table w-full">
            <thead>
              <tr class="border-b border-gray-200">
                <th class="text-left py-3 px-4 font-semibold text-gray-700">{$t.projects.taskName}</th>
                <th class="text-left py-3 px-4 font-semibold text-gray-700">{$t.common.description}</th>
                <th class="text-left py-3 px-4 font-semibold text-gray-700">{$t.projects.assignedTo}</th>
                <th class="text-left py-3 px-4 font-semibold text-gray-700">{$t.common.status}</th>
                <th class="text-left py-3 px-4 font-semibold text-gray-700">{$t.projects.phase}</th>
                <th class="text-left py-3 px-4 font-semibold text-gray-700">{$t.projects.startDate}</th>
                <th class="text-left py-3 px-4 font-semibold text-gray-700">{$t.projects.dueDate}</th>
                <th class="text-left py-3 px-4 font-semibold text-gray-700">{$t.common.hours}</th>
                <th class="text-left py-3 px-4 font-semibold text-gray-700">{$t.common.cost}</th>
              </tr>
            </thead>
            <tbody>
              {#each selectedProject.Tasks as task}
                <TaskRow {task} rates={hourlyRates} projectBudget={selectedProject.budget} />
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="text-center py-12">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p class="text-gray-500 text-lg">{$t.projects.noTasks}</p>
        </div>
      {/if}
    </div>
  </div>
</div>
