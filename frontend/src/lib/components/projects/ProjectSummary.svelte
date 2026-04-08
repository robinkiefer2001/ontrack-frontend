<script lang="ts">
  import type { Project, HourlyRate } from "$lib/modules/projects/contracts";
  import { getProjectBudgetSummary } from "$lib/modules/projects/business";
  import { formatBudget } from "$lib/utils/format";
  import { DEFAULT_HOURLY_RATES } from "$lib/modules/projects/rates";
  import { t } from "$lib/language";

  export let project: Project | null = null;
  export let rates: HourlyRate[] = DEFAULT_HOURLY_RATES;

  $: summary = project ? getProjectBudgetSummary(project, rates) : null;
</script>

{#if project && summary}
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
    <h2 class="text-2xl font-bold text-gray-900 mb-6">{$t.projects.projectSummary} - {$t.projects.budgetAllocation}</h2>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Project Budget -->
      <div class="border-l-4 border-blue-500 pl-4">
        <p class="text-sm text-gray-600 mb-1">{$t.projects.budget}</p>
        <p class="text-3xl font-bold text-blue-600">{formatBudget(project.budget)}</p>
        <p class="text-xs text-gray-500 mt-1">Total project budget</p>
      </div>

      <!-- Assigned Budget -->
      <div class="border-l-4 border-green-500 pl-4">
        <p class="text-sm text-gray-600 mb-1">{$t.projects.assignedBudget}</p>
        <p class="text-3xl font-bold text-green-600">{formatBudget(summary.assignedBudget)}</p>
        <p class="text-xs text-gray-500 mt-1">
          {summary.percentageUsed.toFixed(1)}% {$t.projects.ofBudget}
        </p>
      </div>

      <!-- Reserve -->
      <div class="border-l-4 border-green-500 pl-4">
        <p class="text-sm text-gray-600 mb-1">{$t.projects.reserveBudget}</p>
        <p class="text-3xl font-bold text-green-600">{formatBudget(summary.reserveBudget)}</p>
        <p class="text-xs text-gray-500 mt-1">{$t.projects.budget} - {$t.projects.assignedBudget}</p>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="mt-6">
      <div class="flex items-center justify-between mb-2">
        <p class="text-sm font-semibold text-gray-700">Budget Usage</p>
        <p class={`text-sm font-semibold ${summary.isOverBudget ? "text-red-600" : "text-green-600"}`}>
          {formatBudget(summary.totalCost)} / {formatBudget(project.budget)}
        </p>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
        <div
          class={`h-4 rounded-full transition-all ${
            summary.percentageUsed > 100
              ? "bg-red-600"
              : "bg-green-500"
          }`}
          style={`width: ${Math.min(summary.percentageUsed, 100)}%`}
        ></div>
      </div>
    </div>

    <!-- Over Budget Warning -->
    {#if summary.isOverBudget}
      <div class="mt-4 p-4 bg-red-50 border-l-4 border-red-600 rounded">
        <div class="flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <div>
            <p class="font-bold text-red-800">BUDGET EXCEEDED!</p>
            <p class="text-sm text-red-700 mt-1">
              You have exceeded the budget by {formatBudget(summary.totalCost - (project.budget || 0))}.
              Please adjust task allocations or increase the project budget.
            </p>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}
