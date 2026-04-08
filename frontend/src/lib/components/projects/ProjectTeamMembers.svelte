<script lang="ts">
  import type { Project, HourlyRate } from "$lib/modules/projects/contracts";
  import { getTeamMembers, getTaskCost } from "$lib/modules/projects/business";
  import { dueDateLabel, formatBudget } from "$lib/utils/format";
  import { t } from "$lib/language";

  export let project: Project;
  export let hourlyRates: HourlyRate[];

  let expandedTeamMembers = new Set<string>();

  $: teamMembers = getTeamMembers(project, hourlyRates);

  function toggleMember(name: string) {
    if (expandedTeamMembers.has(name)) {
      expandedTeamMembers.delete(name);
    } else {
      expandedTeamMembers.add(name);
    }
    expandedTeamMembers = expandedTeamMembers;
  }
</script>

<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
  <h2 class="text-2xl font-bold text-gray-900 mb-6">{$t.projects.teamMembers}</h2>

  {#if teamMembers.length > 0}
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-gray-200">
            <th class="w-12"></th>
            <th class="text-left py-3 px-4 font-semibold text-gray-700">{$t.projects.memberName}</th>
            <th class="text-center py-3 px-4 font-semibold text-gray-700">{$t.projects.role}</th>
            <th class="text-center py-3 px-4 font-semibold text-gray-700">{$t.projects.assignedTasks}</th>
            <th class="text-center py-3 px-4 font-semibold text-gray-700">{$t.projects.memberWorkload}</th>
            <th class="text-right py-3 px-4 font-semibold text-gray-700">{$t.projects.memberBudget}</th>
            <th class="text-center py-3 px-4 font-semibold text-gray-700">{$t.projects.memberStatus}</th>
          </tr>
        </thead>
        <tbody>
          {#each teamMembers as member (member.name)}
            <tr class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" on:click={() => toggleMember(member.name)}>
              <td class="py-3 px-4 text-center">
                <button class="rounded-md px-2 py-1 text-sm text-gray-500 transition hover:bg-gray-100" on:click|stopPropagation>
                  {expandedTeamMembers.has(member.name) ? "-" : "+"}
                </button>
              </td>
              <td class="py-3 px-4"><p class="font-medium text-gray-900">{member.name}</p></td>
              <td class="py-3 px-4 text-center">
                <span class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${member.role === "ProjectManager" ? "bg-blue-100 text-blue-700" : "border border-gray-300 bg-white text-gray-600"}`}>
                  {member.role === "ProjectManager" ? $t.projects.projectManager : $t.projects.member}
                </span>
              </td>
              <td class="py-3 px-4 text-center"><span class="inline-flex items-center rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600">{member.tasks.length}</span></td>
              <td class="py-3 px-4 text-center"><p class="font-semibold text-gray-900">{member.totalHours}h</p></td>
              <td class="py-3 px-4 text-right"><p class="font-semibold text-gray-900">{formatBudget(member.totalBudget)}</p></td>
              <td class="py-3 px-4 text-center">
                <div class="flex items-center justify-center gap-2">
                  <div class={`w-3 h-3 rounded-full ${member.isOnTrack ? "bg-green-500" : "bg-red-500"}`}></div>
                  <span class={`text-sm font-semibold ${member.isOnTrack ? "text-green-600" : "text-red-600"}`}>
                    {member.isOnTrack ? $t.projects.onTrack : $t.projects.behind}
                  </span>
                </div>
              </td>
            </tr>

            {#if expandedTeamMembers.has(member.name) && member.tasks.length > 0}
              <tr class="bg-gray-50 border-b border-gray-100">
                <td colspan="7" class="p-0">
                  <div class="p-6 space-y-4">
                    <h4 class="text-lg font-semibold text-gray-900 mb-4">{$t.projects.tasks} & {$t.projects.subtasks}</h4>
                    <div class="space-y-3">
                      {#each member.tasks as task}
                        <div class="border-l-4 border-blue-500 pl-4 py-2 bg-white rounded p-3">
                          <div class="flex items-start justify-between gap-4">
                            <div class="flex-1">
                              <p class="font-semibold text-gray-900">{task.title}</p>
                              <p class="text-sm text-gray-600 mt-1">{task.description || "-"}</p>
                              <div class="flex gap-2 mt-2">
                                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap
                                  {task.status === 'Pending' ? 'bg-gray-100 text-gray-700' : task.status === 'Done' ? 'bg-green-100 text-green-700' : task.status === 'In Progress' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}"
                                >
                                  {task.status === "Pending" ? $t.taskStatus.pending : task.status === "To Do" ? $t.taskStatus.toDo : task.status === "In Progress" ? $t.taskStatus.inProgress : $t.taskStatus.done}
                                </span>
                                {#if task.projectPhase}<span class="inline-flex items-center rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-600">{task.projectPhase}</span>{/if}
                              </div>
                            </div>
                            <div class="text-right whitespace-nowrap">
                              <p class="text-sm text-gray-600">{task.estimatedHours || 0}h</p>
                              <p class="text-sm font-semibold text-gray-900">{formatBudget(getTaskCost(task, hourlyRates))}</p>
                              {#if task.dueDate}<p class="text-xs text-gray-500 mt-1">{dueDateLabel(task.dueDate)}</p>{/if}
                            </div>
                          </div>

                          {#if task.subtasks && task.subtasks.length > 0}
                            <div class="mt-3 ml-4 space-y-2 border-l-2 border-gray-300 pl-4">
                              {#each task.subtasks as subtask}
                                <div class="py-2 bg-gray-100 rounded p-3">
                                  <div class="flex items-start justify-between gap-3">
                                    <div class="flex-1">
                                      <div class="flex items-center gap-2">
                                        <p class="font-medium text-gray-800 text-sm">{subtask.title}</p>
                                        {#if subtask.assignedTo}
                                          <span class="text-xs text-gray-600 bg-white px-2 py-1 rounded">{subtask.assignedTo}</span>
                                        {/if}
                                      </div>
                                      {#if subtask.description}
                                        <p class="text-xs text-gray-600 mt-1">{subtask.description}</p>
                                      {/if}
                                    </div>
                                    <div class="text-right whitespace-nowrap text-xs">
                                      <p class="text-gray-600">{subtask.estimatedHours || 0}h</p>
                                      {#if subtask.dueDate}<p class="text-gray-500 mt-1">{dueDateLabel(subtask.dueDate)}</p>{/if}
                                    </div>
                                  </div>
                                </div>
                              {/each}
                            </div>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="text-center py-8"><p class="text-gray-500">{$t.projects.noTeamMembers}</p></div>
  {/if}
</div>
