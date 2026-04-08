<script lang="ts">
  import type { Task } from "$lib/modules/projects/contracts";
  import type { HourlyRate } from "$lib/modules/projects/contracts";
  import { getTaskHours, getTaskCost, getTaskBudgetPercentage } from "$lib/modules/projects/business";
  import { formatBudget } from "$lib/utils/format";
  import { DEFAULT_HOURLY_RATES, getHourlyRate } from "$lib/modules/projects/rates";
  import { createEventDispatcher } from "svelte";
  import { t } from "$lib/language";

  export let task: Task;
  export let rates: HourlyRate[] = DEFAULT_HOURLY_RATES;
  export let projectBudget: number | null = null;

  const dispatch = createEventDispatcher<{
    editTask: Task;
    deleteTask: number;
  }>();

  let isExpanded = false;

  $: totalHours = getTaskHours(task);
  $: totalCost = getTaskCost(task, rates);
  $: budgetPercentage = getTaskBudgetPercentage(task, projectBudget, rates);

  function taskStatusLabel(status: Task["status"]) {
    if (status === "Pending") return $t.taskStatus.pending;
    if (status === "To Do") return $t.taskStatus.toDo;
    if (status === "In Progress") return $t.taskStatus.inProgress;
    return $t.taskStatus.done;
  }
</script>

<!-- Main Task Row -->
<tr class="border-b border-gray-100 hover:bg-gray-50">
  <td class="py-3 px-4">
    <div class="flex items-center gap-2">
      {#if task.subtasks && task.subtasks.length > 0}
        <button
          class="rounded-md p-1 text-gray-500 transition hover:bg-gray-100"
          on:click={() => (isExpanded = !isExpanded)}
          title={isExpanded ? $t.common.collapse : $t.common.expand}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 transition-transform"
            class:rotate-90={isExpanded}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      {/if}
      <span class="font-medium text-gray-900">{task.title}</span>
    </div>
  </td>
  <td class="py-3 px-4 text-gray-600 max-w-xs truncate">{task.description || "-"}</td>
  <td class="py-3 px-4 text-gray-600">{task.assignedTo || "-"}</td>
  <td class="py-3 px-4">
    <span
      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap
        {task.status === 'Pending' ? 'bg-gray-100 text-gray-700' : task.status === 'Done' ? 'bg-green-100 text-green-700' : task.status === 'In Progress' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}"
    >
      {taskStatusLabel(task.status)}
    </span>
  </td>
  <td class="py-3 px-4">
    <span class="inline-flex items-center rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600">
      {task.projectPhase || "-"}
    </span>
  </td>
  <td class="py-3 px-4 text-gray-600">
    {task.startDate ? new Date(task.startDate).toLocaleDateString("de-CH") : "-"}
  </td>
  <td class="py-3 px-4 text-gray-600">
    {task.dueDate ? new Date(task.dueDate).toLocaleDateString("de-CH") : "-"}
  </td>
  <td class="py-3 px-4 font-medium text-gray-700">
    {totalHours.toFixed(1)}h
    {#if task.subtasks && task.subtasks.length > 0}
      <span class="text-gray-500 text-sm ml-1">({$t.projects.includingSubtasks})</span>
    {/if}
  </td>
  <td class="py-3 px-4">
    <div class="flex flex-col">
      <span class="font-medium text-gray-900">{formatBudget(totalCost)}</span>
      {#if projectBudget && budgetPercentage > 0}
        <span class="text-xs text-gray-500">{budgetPercentage.toFixed(1)}% {$t.projects.ofBudget}</span>
      {/if}
    </div>
  </td>
</tr>

<!-- Subtasks Rows -->
{#if isExpanded && task.subtasks && task.subtasks.length > 0}
  {#each task.subtasks as subtask (subtask.subtaskID)}
    {@const subtaskHours = subtask.estimatedHours || 0}
    {@const subtaskRate = getHourlyRate(subtask.hourlyRateType, rates)}
    {@const subtaskCost = subtaskHours * subtaskRate}
    <tr class="border-b border-gray-50 bg-gray-50/50 hover:bg-gray-50">
      <td class="py-3 px-4 pl-12">
        <div class="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 9l3 3L8 20" />
          </svg>
          <span class="italic text-gray-700">{subtask.title}</span>
        </div>
      </td>
      <td class="py-3 px-4 text-gray-500 text-sm max-w-xs truncate">{subtask.description || "-"}</td>
      <td class="py-3 px-4 text-gray-600 text-sm">{subtask.assignedTo || "-"}</td>
      <td class="py-3 px-4">
        <span
          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap
            {subtask.status === 'Pending' ? 'bg-gray-100 text-gray-700' : subtask.status === 'Done' ? 'bg-green-100 text-green-700' : subtask.status === 'In Progress' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}"
        >
          {taskStatusLabel(subtask.status)}
        </span>
      </td>
      <td class="py-3 px-4 text-sm text-gray-500">-</td>
      <td class="py-3 px-4 text-gray-600 text-sm">
        {subtask.startDate ? new Date(subtask.startDate).toLocaleDateString("de-CH") : "-"}
      </td>
      <td class="py-3 px-4 text-gray-600 text-sm">
        {subtask.dueDate ? new Date(subtask.dueDate).toLocaleDateString("de-CH") : "-"}
      </td>
      <td class="py-3 px-4 text-gray-600 text-sm">{subtaskHours.toFixed(1)}h</td>
      <td class="py-3 px-4 text-gray-600 text-sm">
        {formatBudget(subtaskCost)}
      </td>
    </tr>
  {/each}
{/if}
