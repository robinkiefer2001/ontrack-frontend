<script lang="ts">
  import type { Project, HourlyRate } from "$lib/modules/projects/contracts";
  import { getPhaseHoursSummary } from "$lib/modules/projects/business";
  import { formatBudget } from "$lib/utils/format";
  import { DEFAULT_HOURLY_RATES } from "$lib/modules/projects/rates";

  export let project: Project | null = null;
  export let rates: HourlyRate[] = DEFAULT_HOURLY_RATES;

  type PhaseName = "Initiation" | "Planing" | "Execution" | "Closure";
  const phaseNames: PhaseName[] = ["Initiation", "Planing", "Execution", "Closure"];
  const phaseColors: Record<PhaseName, { bg: string; text: string; border: string }> = {
    Initiation: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    Planing: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
    Execution: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
    Closure: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  };

  $: phases = project
    ? phaseNames.map((phaseName) => {
        const summary = getPhaseHoursSummary(project, phaseName, rates);
        return { name: phaseName, summary };
      })
    : [];
</script>

<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
  <h2 class="text-2xl font-bold text-gray-900 mb-6">Phase Budgets & Hours</h2>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {#each phases as phase (phase.name)}
      <div class={`rounded-lg border-2 p-4 ${phaseColors[phase.name].bg} ${phaseColors[phase.name].border}`}>
        <h3 class={`font-semibold text-lg mb-4 ${phaseColors[phase.name].text}`}>{phase.name}</h3>

        <div class="space-y-3">
          <!-- Hours -->
          <div>
            <p class="text-sm text-gray-600 mb-1">Total Hours</p>
            <p class="text-2xl font-bold text-gray-900">{phase.summary.totalHours.toFixed(1)}h</p>
          </div>

          <!-- Cost -->
          <div>
            <p class="text-sm text-gray-600 mb-1">Total Cost</p>
            <p class={`text-lg font-semibold ${phase.summary.isOverBudget ? "text-red-600" : "text-green-600"}`}>{formatBudget(phase.summary.totalCost)}</p>
          </div>

          <!-- Percentage Bar -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm text-gray-600">% of Budget</p>
              <p class={`text-sm font-semibold ${phase.summary.isOverBudget ? "text-red-600" : "text-green-600"}`}>
                {phase.summary.percentageUsed.toFixed(1)}%
              </p>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                class={`h-2.5 rounded-full ${
                  phase.summary.percentageUsed > 100
                    ? "bg-red-600"
                    : "bg-green-500"
                }`}
                style={`width: ${Math.min(phase.summary.percentageUsed, 100)}%`}
              ></div>
            </div>
          </div>

          <!-- Over Budget Warning -->
          {#if phase.summary.isOverBudget}
            <div class="mt-3 pt-3 border-t border-current/20 flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="mt-0.5 h-5 w-5 shrink-0 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <div>
                <p class="text-xs font-semibold text-red-600">OVER BUDGET</p>
                <p class="text-xs text-red-600">
                  {#if phase.summary.percentageUsed > 100}
                    <span class="text-red-600 font-semibold">+{formatBudget(phase.summary.totalCost * (phase.summary.percentageUsed - 100) / 100)}</span>
                  {/if}
                </p>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>
