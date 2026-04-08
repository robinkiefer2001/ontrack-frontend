<script lang="ts">
  import type { Project, HourlyRate } from "$lib/modules/projects/contracts";
  import { formatBudget, dueDateLabel } from "$lib/utils/format";
  import { ProjectSummary, PhaseBudgetStats, TimelineChart } from "$lib/modules/projects/ui";
  import { t } from "$lib/language";

  export let project: Project;
  export let hourlyRates: HourlyRate[];
</script>

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-gray-500">{$t.projects.projectManager}</p>
        <p class="text-xl font-semibold text-gray-900 mt-1">{project.projectManager || "-"}</p>
      </div>
      <div class="bg-blue-100 rounded-full p-3">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
    </div>
  </div>

  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-gray-500">{$t.projects.budget}</p>
        <p class="text-xl font-semibold text-gray-900 mt-1">{formatBudget(project.budget)}</p>
      </div>
      <div class="bg-green-100 rounded-full p-3">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    </div>
  </div>

  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-gray-500">{$t.projects.startDate}</p>
        <p class="text-xl font-semibold text-gray-900 mt-1">{dueDateLabel(project.startDate)}</p>
      </div>
      <div class="bg-purple-100 rounded-full p-3">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    </div>
  </div>

  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-gray-500">{$t.projects.dueDate}</p>
        <p class="text-xl font-semibold text-gray-900 mt-1">{dueDateLabel(project.dueDate)}</p>
      </div>
      <div class="bg-orange-100 rounded-full p-3">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
    </div>
  </div>
</div>

<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
  <h2 class="text-2xl font-bold text-gray-900 mb-6">{$t.projects.projectPhases}</h2>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <div class="border-l-4 border-blue-500 pl-4">
      <h3 class="text-lg font-semibold text-gray-900 mb-2">{$t.projects.initiation}</h3>
      <p class="text-sm text-gray-600"><span class="font-medium">{$t.projects.start}:</span> {dueDateLabel(project.initiationPhase[0]?.startDate ?? null)}</p>
      <p class="text-sm text-gray-600"><span class="font-medium">{$t.projects.end}:</span> {dueDateLabel(project.initiationPhase[0]?.dueDate ?? null)}</p>
    </div>
    <div class="border-l-4 border-green-500 pl-4">
      <h3 class="text-lg font-semibold text-gray-900 mb-2">{$t.projects.planning}</h3>
      <p class="text-sm text-gray-600"><span class="font-medium">{$t.projects.start}:</span> {dueDateLabel(project.planingPhase[0]?.startDate ?? null)}</p>
      <p class="text-sm text-gray-600"><span class="font-medium">{$t.projects.end}:</span> {dueDateLabel(project.planingPhase[0]?.dueDate ?? null)}</p>
    </div>
    <div class="border-l-4 border-yellow-500 pl-4">
      <h3 class="text-lg font-semibold text-gray-900 mb-2">{$t.projects.execution}</h3>
      <p class="text-sm text-gray-600"><span class="font-medium">{$t.projects.start}:</span> {dueDateLabel(project.executionPhase[0]?.startDate ?? null)}</p>
      <p class="text-sm text-gray-600"><span class="font-medium">{$t.projects.end}:</span> {dueDateLabel(project.executionPhase[0]?.dueDate ?? null)}</p>
    </div>
    <div class="border-l-4 border-purple-500 pl-4">
      <h3 class="text-lg font-semibold text-gray-900 mb-2">{$t.projects.closure}</h3>
      <p class="text-sm text-gray-600"><span class="font-medium">{$t.projects.start}:</span> {dueDateLabel(project.closurePhase[0]?.startDate ?? null)}</p>
      <p class="text-sm text-gray-600"><span class="font-medium">{$t.projects.end}:</span> {dueDateLabel(project.closurePhase[0]?.dueDate ?? null)}</p>
    </div>
  </div>
</div>

<ProjectSummary {project} rates={hourlyRates} />
<PhaseBudgetStats {project} rates={hourlyRates} />

<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
  <h2 class="text-2xl font-bold text-gray-900 mb-6">{$t.projects.projectTimeline}</h2>
  <TimelineChart
    start={project.startDate}
    end={project.dueDate}
    tasks={project.Tasks || []}
    phases={{
      initiation: project.initiationPhase,
      planing: project.planingPhase,
      execution: project.executionPhase,
      closure: project.closurePhase,
    }}
  />
</div>
