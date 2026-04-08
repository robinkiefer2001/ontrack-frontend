<script lang="ts">
  import type { Customer, HourlyRate, Project, ProjectPhase, Task } from "$lib/modules/projects/contracts";
  import type { SubtaskDraft, SubtaskDraftItem, TaskDraft } from "$lib/modules/projects/models";
  import { TimelineChart } from "$lib/modules/projects/ui";
  import { toInputDate } from "$lib/utils/date";
  import { t } from "$lib/language";

  export let initProject: Project | null = null;
  export let showCustomerSelect = false;
  export let customerSearchText = "";
  export let filteredCustomerList: Customer[] = [];
  export let newTask: TaskDraft;
  export let newSubtask: SubtaskDraft;
  export let currentTaskSubtasks: SubtaskDraftItem[] = [];
  export let selectedTasks = new Set<number>();
  export let hourlyRates: HourlyRate[] = [];
  export let taskPhaseRange: { start: string | null; end: string | null } = {
    start: null,
    end: null,
  };

  export let selectCustomer: () => void;
  export let setTaskPhase: (name: ProjectPhase["phaseName"]) => void;
  export let addSubtask: () => void;
  export let removeSubtask: (subtaskID: number | string) => void;
  export let addTask: () => void;
  export let toggleSelectAll: () => void;
  export let toggleTaskSelection: (taskID: number) => void;
  export let editTask: (taskID: number) => void;
  export let removeTask: (taskID: number) => void;
  export let deleteSelectedTasks: () => void;
  export let submitNewProject: () => void;
  export let cancelNewProject: () => void;

  let timelineChartRef: InstanceType<typeof TimelineChart> | null = null;
  let riskTitle = "";
  let riskImpact: "Low" | "Medium" | "High" = "Medium";
  let riskProbability: "Low" | "Medium" | "High" = "Medium";
  let riskMitigation = "";
  let activeTab: "details" | "phases" | "tasks" | "notifications" = "details";

  function addProjectRisk() {
    if (!initProject || !riskTitle.trim()) return;
    const next = {
      id: `risk-${Date.now()}`,
      title: riskTitle.trim(),
      impact: riskImpact,
      probability: riskProbability,
      mitigation: riskMitigation.trim(),
      isOpen: true,
    };
    initProject.risks = [...(initProject.risks || []), next];
    riskTitle = "";
    riskMitigation = "";
    riskImpact = "Medium";
    riskProbability = "Medium";
  }

  function removeProjectRisk(id: string) {
    if (!initProject?.risks) return;
    initProject.risks = initProject.risks.filter((risk) => risk.id !== id);
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
  <div class="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-gray-200 bg-white p-6 shadow-xl">

    <!-- Tabs -->
    <div class="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
      <button type="button" class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition {activeTab === 'details' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}" on:click={() => (activeTab = 'details')}>{$t.projects.projectDetails}</button>
      <button type="button" class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition {activeTab === 'phases' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}" on:click={() => (activeTab = 'phases')}>{$t.projects.projectPhases}</button>
      <button type="button" class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition {activeTab === 'tasks' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}" on:click={() => (activeTab = 'tasks')}>{$t.projects.tasks}</button>
      <button type="button" class="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition {activeTab === 'notifications' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}" on:click={() => (activeTab = 'notifications')}>{$t.projects.notifications}</button>
    </div>

    <!-- Details Tab -->
    {#if activeTab === "details"}
      <div class="rounded-2xl border border-gray-200 bg-white p-5 mb-5">
        <h3 class="text-xl font-bold mb-4">{$t.projects.projectDetails}</h3>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label class="flex flex-col gap-1 md:col-span-2">
            <span class="text-sm font-medium text-gray-700">{$t.projects.projectName}</span>
            <input type="text" placeholder={$t.projects.typeHere} class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" bind:value={initProject!.title} />
          </label>

          <div class="relative flex flex-col gap-1 md:col-span-2">
            <span class="text-sm font-medium text-gray-700">{$t.projects.customer}</span>
            <button
              type="button"
              class="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200"
              on:click={selectCustomer}
            >
              <span class={initProject!.customerName ? "text-gray-900" : "text-gray-400"}>
                {initProject!.customerName || $t.projects.selectCustomer}
              </span>
              <span class="text-xs text-gray-400">▼</span>
            </button>

            {#if showCustomerSelect}
              <div class="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                <input
                  type="text"
                  placeholder={$t.projects.searchCustomer}
                  class="mb-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200"
                  bind:value={customerSearchText}
                />
                <div class="max-h-56 overflow-y-auto rounded-lg border border-gray-100">
                  {#if filteredCustomerList.length > 0}
                    <ul class="divide-y divide-gray-100">
                      {#each filteredCustomerList as c}
                        <li>
                          <button
                            type="button"
                            class="w-full px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
                            on:click={() => {
                              initProject!.customerID = c.customerID;
                              initProject!.customerName = c.companyName;
                              showCustomerSelect = false;
                            }}
                          >
                            {c.companyName}
                          </button>
                        </li>
                      {/each}
                    </ul>
                  {:else}
                    <p class="p-3 text-sm text-gray-400">{$t.home.noAssignments}</p>
                  {/if}
                </div>
                <div class="mt-2 flex justify-end">
                  <button type="button" class="rounded-lg px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100" on:click={() => (showCustomerSelect = false)}>{$t.common.close}</button>
                </div>
              </div>
            {/if}
          </div>

          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">{$t.projects.projectManager}</span>
            <input type="text" placeholder={$t.projects.typeHere} class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" bind:value={initProject!.projectManager} />
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">{$t.projects.budget}</span>
            <input type="number" placeholder={$t.projects.budgetPlaceholder} class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" bind:value={initProject!.budget} min="0" step="0.01" />
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">{$t.projects.startDate}</span>
            <input type="date" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" bind:value={initProject!.startDate} />
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">{$t.projects.dueDate}</span>
            <input type="date" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" bind:value={initProject!.dueDate} />
          </label>
        </div>
      </div>

      <div class="border-t border-gray-200 my-6"></div>
      <h3 class="text-xl font-bold mb-4">Project Risks</h3>
      <div class="grid grid-cols-2 gap-4 mb-4">
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">Risk Title</span>
          <input type="text" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" placeholder="Risk summary" bind:value={riskTitle} />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">Mitigation</span>
          <input type="text" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" placeholder="Mitigation action" bind:value={riskMitigation} />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">Impact</span>
          <select class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" bind:value={riskImpact}>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">Probability</span>
          <select class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" bind:value={riskProbability}>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </label>
      </div>
      <button type="button" class="mb-4 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200" on:click={addProjectRisk} disabled={!riskTitle.trim()}>Add Risk</button>

      {#if initProject?.risks && initProject.risks.length > 0}
        <div class="mb-4 overflow-x-auto rounded-2xl border border-gray-200">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th class="px-4 py-3">Risk</th>
                <th class="px-4 py-3">Impact</th>
                <th class="px-4 py-3">Probability</th>
                <th class="px-4 py-3">Mitigation</th>
                <th class="px-4 py-3">{$t.projects.action}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              {#each initProject.risks as risk (risk.id)}
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3">{risk.title}</td>
                  <td class="px-4 py-3">{risk.impact}</td>
                  <td class="px-4 py-3">{risk.probability}</td>
                  <td class="px-4 py-3">{risk.mitigation || "-"}</td>
                  <td class="px-4 py-3"><button type="button" class="rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50" on:click={() => removeProjectRisk(risk.id)}>{$t.common.delete}</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

    <!-- Phases Tab -->
    {:else if activeTab === "phases"}
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-5">
          <h3 class="text-lg font-bold text-gray-900 mb-2">{$t.projects.initiation}</h3>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">{$t.projects.startDate}</span>
            <input type="date" class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm" bind:value={initProject!.initiationPhase[0].startDate} readonly />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">{$t.projects.dueDate}</span>
            <input type="date" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" bind:value={initProject!.initiationPhase[0].dueDate} min={toInputDate(initProject!.initiationPhase[0].startDate) || undefined} max={toInputDate(initProject!.dueDate) || undefined} />
          </label>
        </div>
        <div class="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-5">
          <h3 class="text-lg font-bold text-gray-900 mb-2">{$t.projects.planning}</h3>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">{$t.projects.startDate}</span>
            <input type="date" class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm" bind:value={initProject!.planingPhase[0].startDate} readonly />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">{$t.projects.dueDate}</span>
            <input type="date" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" bind:value={initProject!.planingPhase[0].dueDate} min={toInputDate(initProject!.planingPhase[0].startDate) || undefined} max={toInputDate(initProject!.dueDate) || undefined} />
          </label>
        </div>
        <div class="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-5">
          <h3 class="text-lg font-bold text-gray-900 mb-2">{$t.projects.execution}</h3>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">{$t.projects.startDate}</span>
            <input type="date" class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm" bind:value={initProject!.executionPhase[0].startDate} readonly />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">{$t.projects.dueDate}</span>
            <input type="date" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" bind:value={initProject!.executionPhase[0].dueDate} min={toInputDate(initProject!.executionPhase[0].startDate) || undefined} max={toInputDate(initProject!.dueDate) || undefined} />
          </label>
        </div>
        <div class="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-5">
          <h3 class="text-lg font-bold text-gray-900 mb-2">{$t.projects.closure}</h3>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">{$t.projects.startDate}</span>
            <input type="date" class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm" bind:value={initProject!.closurePhase[0].startDate} readonly />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">{$t.projects.dueDate}</span>
            <input type="date" class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm" bind:value={initProject!.closurePhase[0].dueDate} readonly />
          </label>
        </div>
      </div>

    <!-- Tasks Tab -->
    {:else if activeTab === "tasks"}
      <div class="grid grid-cols-2 gap-4 mb-4">
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">{$t.projects.taskName}</span>
          <input type="text" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" placeholder={$t.projects.enterTaskName} bind:value={newTask.title} />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">{$t.projects.assignedTo}</span>
          <input type="text" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" placeholder={$t.projects.namePlaceholder} bind:value={newTask.assignedTo} />
        </label>
        <div class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">{$t.common.status}</span>
          <input type="text" class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500" value={$t.taskStatus.pending} readonly disabled />
        </div>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">{$t.projects.phase}</span>
          <select class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" bind:value={newTask.projectPhase} on:change={(e) => setTaskPhase(e.currentTarget.value as ProjectPhase["phaseName"])}>
            <option disabled selected value="">{$t.projects.selectPhase}</option>
            <option value="Initiation">{$t.projects.initiation}</option>
            <option value="Planing">{$t.projects.planning}</option>
            <option value="Execution">{$t.projects.execution}</option>
            <option value="Closure">{$t.projects.closure}</option>
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">{$t.projects.startDate}</span>
          <input type="date" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" bind:value={newTask.startDate} min={taskPhaseRange.start || undefined} max={taskPhaseRange.end || undefined} disabled={!newTask.projectPhase} />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">{$t.projects.dueDate}</span>
          <input type="date" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" bind:value={newTask.dueDate} min={taskPhaseRange.start || undefined} max={taskPhaseRange.end || undefined} disabled={!newTask.projectPhase} />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">{$t.common.description}</span>
          <textarea class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" rows="3" placeholder={$t.projects.descriptionPlaceholder} bind:value={newTask.description}></textarea>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">{$t.projects.estimatedHours}</span>
          <input type="number" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" placeholder={$t.projects.taskHoursPlaceholder} bind:value={newTask.estimatedHours} min="0" step="0.5" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">{$t.projects.hourlyRateType}</span>
          <select class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" bind:value={newTask.hourlyRateType}>
            {#each hourlyRates as rate (rate.rateID)}
              <option value={rate.rateType}>{rate.rateType}</option>
            {/each}
          </select>
        </label>
        <label class="flex items-center gap-2 self-end py-2">
          <input type="checkbox" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" bind:checked={newTask.isCritical} />
          <span class="text-sm font-medium text-gray-700">Critical Task</span>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-sm font-medium text-gray-700">Risk Note</span>
          <textarea class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" rows="2" placeholder="Risk note for this task" bind:value={newTask.riskNote}></textarea>
        </label>
      </div>

      <div class="border-t border-gray-200 my-6"></div>
      <h3 class="text-xl font-bold mb-4">{$t.projects.addSubtasks}</h3>

      <div class="grid grid-cols-2 gap-4 mb-4">
        <label class="flex flex-col gap-1"><span class="text-sm font-medium text-gray-700">{$t.projects.subtaskName}</span><input type="text" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" placeholder={$t.projects.enterSubtaskName} bind:value={newSubtask.title} /></label>
        <label class="flex flex-col gap-1"><span class="text-sm font-medium text-gray-700">{$t.projects.assignedTo}</span><input type="text" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" placeholder={$t.projects.namePlaceholder} bind:value={newSubtask.assignedTo} /></label>
        <label class="flex flex-col gap-1"><span class="text-sm font-medium text-gray-700">{$t.projects.startDate}</span><input type="date" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" bind:value={newSubtask.startDate} min={taskPhaseRange.start || undefined} max={taskPhaseRange.end || undefined} /></label>
        <label class="flex flex-col gap-1"><span class="text-sm font-medium text-gray-700">{$t.projects.dueDate}</span><input type="date" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" bind:value={newSubtask.dueDate} min={taskPhaseRange.start || undefined} max={taskPhaseRange.end || undefined} /></label>
        <label class="flex flex-col gap-1"><span class="text-sm font-medium text-gray-700">{$t.projects.estimatedHours}</span><input type="number" class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" placeholder={$t.projects.subtaskHoursPlaceholder} bind:value={newSubtask.estimatedHours} min="0" step="0.5" /></label>
        <label class="flex flex-col gap-1"><span class="text-sm font-medium text-gray-700">{$t.projects.hourlyRateType}</span><select class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" bind:value={newSubtask.hourlyRateType}>{#each hourlyRates as rate (rate.rateID)}<option value={rate.rateType}>{rate.rateType}</option>{/each}</select></label>
        <label class="flex flex-col gap-1"><span class="text-sm font-medium text-gray-700">{$t.common.description}</span><textarea class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" rows="2" placeholder={$t.projects.subtaskDescriptionPlaceholder} bind:value={newSubtask.description}></textarea></label>
        <label class="flex items-center gap-2 self-end py-2"><input type="checkbox" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" bind:checked={newSubtask.isCritical} /><span class="text-sm font-medium text-gray-700">Critical Subtask</span></label>
        <label class="flex flex-col gap-1"><span class="text-sm font-medium text-gray-700">Risk Note</span><textarea class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200" rows="2" placeholder="Risk note for this subtask" bind:value={newSubtask.riskNote}></textarea></label>
      </div>

      <button type="button" class="mb-4 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200" on:click={addSubtask} disabled={!newSubtask.title.trim()}>{$t.projects.addSubtask}</button>

      {#if currentTaskSubtasks.length > 0}
        <h4 class="text-lg font-bold mb-3">{$t.projects.currentSubtasks} ({currentTaskSubtasks.length})</h4>
        <div class="mb-4 overflow-x-auto rounded-2xl border border-gray-200">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"><th class="px-4 py-3">{$t.projects.subtasks}</th><th class="px-4 py-3">Critical</th><th class="px-4 py-3">Risk</th><th class="px-4 py-3">{$t.projects.assignedTo}</th><th class="px-4 py-3">{$t.common.hours}</th><th class="px-4 py-3">{$t.projects.duration}</th><th class="px-4 py-3">{$t.projects.action}</th></tr></thead>
            <tbody class="divide-y divide-gray-100">
              {#each currentTaskSubtasks as subtask (subtask.subtaskID)}
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3"><div><p class="font-semibold">{subtask.title}</p><p class="text-sm text-gray-500">{subtask.description || "-"}</p></div></td>
                  <td class="px-4 py-3">{subtask.isCritical ? "Yes" : "No"}</td>
                  <td class="max-w-xs truncate px-4 py-3">{subtask.riskNote || "-"}</td>
                  <td class="px-4 py-3">{subtask.assignedTo || "-"}</td>
                  <td class="px-4 py-3"><span class="font-semibold">{subtask.estimatedHours || 0}h</span></td>
                  <td class="px-4 py-3">
                    {#if subtask.startDate && subtask.dueDate}
                      {Math.ceil((new Date(subtask.dueDate).getTime() - new Date(subtask.startDate).getTime()) / (1000 * 60 * 60 * 24))}d
                    {:else}
                      <span class="text-gray-400 italic">{$t.common.optional}</span>
                    {/if}
                  </td>
                  <td class="px-4 py-3"><button type="button" class="rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50" on:click={() => removeSubtask(subtask.subtaskID)}>{$t.common.delete}</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      <button type="button" class="mb-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700" on:click={addTask} disabled={!newTask.title.trim() || !newTask.projectPhase}>{$t.projects.addTask}</button>

      <h3 class="text-xl font-bold mb-4">{$t.projects.tasks} ({initProject?.Tasks.length || 0})</h3>

      {#if initProject && initProject.Tasks.length > 0}
        <div class="overflow-x-auto rounded-2xl border border-gray-200">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th class="px-4 py-3"><input type="checkbox" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" checked={initProject.Tasks.length > 0 && selectedTasks.size === initProject.Tasks.length} on:change={toggleSelectAll} /></th>
                <th class="px-4 py-3">{$t.projects.taskName}</th><th class="px-4 py-3">{$t.common.description}</th><th class="px-4 py-3">Critical</th><th class="px-4 py-3">Risk</th><th class="px-4 py-3">{$t.projects.assignedTo}</th><th class="px-4 py-3">{$t.common.status}</th><th class="px-4 py-3">{$t.projects.phase}</th><th class="px-4 py-3">{$t.projects.dueDate}</th><th class="px-4 py-3">{$t.projects.action}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              {#each initProject.Tasks as task}
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3"><input type="checkbox" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" checked={selectedTasks.has(task.taskID)} on:change={() => toggleTaskSelection(task.taskID)} /></td>
                  <td class="px-4 py-3 font-semibold">{task.title}</td>
                  <td class="max-w-xs truncate px-4 py-3">{task.description || "-"}</td>
                  <td class="px-4 py-3">{task.isCritical ? "Yes" : "No"}</td>
                  <td class="max-w-xs truncate px-4 py-3">{task.riskNote || "-"}</td>
                  <td class="px-4 py-3">{task.assignedTo || "-"}</td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap
                      {task.status === 'Pending' ? 'bg-gray-100 text-gray-700' : task.status === 'Done' ? 'bg-green-100 text-green-700' : task.status === 'In Progress' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}">
                      {task.status === "Pending" ? $t.taskStatus.pending : task.status === "To Do" ? $t.taskStatus.toDo : task.status === "In Progress" ? $t.taskStatus.inProgress : $t.taskStatus.done}
                    </span>
                  </td>
                  <td class="px-4 py-3"><span class="inline-flex items-center rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600">{task.projectPhase || "-"}</span></td>
                  <td class="px-4 py-3">{task.dueDate ? new Date(task.dueDate).toLocaleDateString("de-CH") : "-"}</td>
                  <td class="space-x-2 px-4 py-3">
                    <button type="button" class="rounded-lg border border-amber-300 px-3 py-1 text-xs font-medium text-amber-600 transition hover:bg-amber-50" on:click={() => editTask(task.taskID)}>{$t.common.edit}</button>
                    <button type="button" class="rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50" on:click={() => removeTask(task.taskID)}>{$t.common.delete}</button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700"><span>{$t.projects.noTasksYet}</span></div>
      {/if}

      {#if initProject?.Tasks.length}
        <div class="mt-8 mb-4 flex gap-4">
          <button class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700" on:click={deleteSelectedTasks} disabled={selectedTasks.size === 0}>
            {$t.projects.deleteSelected} ({selectedTasks.size})
          </button>
        </div>

        <div class="mb-4 flex gap-2">
          <button class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200" on:click={() => timelineChartRef?.resetFocus()}>{$t.projects.focus}</button>
        </div>
      {/if}

      <TimelineChart
        bind:this={timelineChartRef}
        start={initProject?.startDate}
        end={initProject?.dueDate}
        tasks={initProject?.Tasks || []}
        phases={
          initProject
            ? {
                initiation: initProject.initiationPhase,
                planing: initProject.planingPhase,
                execution: initProject.executionPhase,
                closure: initProject.closurePhase,
              }
            : null
        }
      />

    <!-- Notifications Tab -->
    {:else if activeTab === "notifications"}
      <div class="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
        <!-- Notifications content placeholder -->
      </div>
    {/if}

    <div class="mt-6 flex gap-3">
      <button type="button" class="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700" on:click={submitNewProject}>{$t.common.submit}</button>
      <button type="button" class="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50" on:click={cancelNewProject}>{$t.common.cancel}</button>
    </div>
  </div>
</div>
