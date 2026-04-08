<script lang="ts">
    import { onMount } from "svelte";

    import { loadHourlyRates } from "$lib/modules/projects/rates";
    import { projectList, updateAssignmentStatus } from "$lib/modules/projects/store";
    import type { Project } from "$lib/modules/projects/contracts";
    import {
        buildDashboardState,
        calculateCompletionRate as calculateCompletionRateMetric,
        calculatePortfolioHealth as calculatePortfolioHealthMetric,
        getOpenItemsCount as getOpenItemsCountMetric,
        getOverdueCount as getOverdueCountMetric,
        getDueSoonCount as getDueSoonCountMetric,
        getAssignedHours as getAssignedHoursMetric,
        getAssignedBudgetTotal as getAssignedBudgetTotalMetric,
        getTimelineDayDiffLabel,
    } from "$lib/modules/dashboard/business";
    import type { WorkStatus, Assignment, ProjectSnapshot } from "$lib/modules/dashboard/contracts";
    import { dueDateLabel, formatBudget } from "$lib/utils/format";
    import { t } from "$lib/language";
    import { currentUser, getUserInitials } from "$lib/modules/user/store";

    let projects = $state<Project[]>([]);
    let userProjects = $state<Project[]>([]);
    let assignments = $state<Assignment[]>([]);
    let priorityAssignments = $state<Assignment[]>([]);
    let projectSnapshots = $state<ProjectSnapshot[]>([]);
    let hourlyRates = $state(loadHourlyRates());
    let statusCounts = $state<Record<WorkStatus, number>>({
        Pending: 0,
        "To Do": 0,
        "In Progress": 0,
        Done: 0,
    });
    let assignmentDrilldownOpen = $state(false);
    let selectedAssignment = $state<Assignment | null>(null);
    let projectDrilldownOpen = $state(false);
    let selectedSnapshot = $state<ProjectSnapshot | null>(null);

    function getFullName(firstName: string, lastName: string): string {
        return `${firstName} ${lastName}`;
    }

    function buildDashboard() {
        hourlyRates = loadHourlyRates();
        const userName = getFullName($currentUser.firstName, $currentUser.lastName);
        const nextState = buildDashboardState(
            projects,
            userName,
            hourlyRates,
        );

        userProjects = nextState.userProjects;
        assignments = nextState.assignments;
        priorityAssignments = nextState.priorityAssignments;
        projectSnapshots = nextState.projectSnapshots;
        statusCounts = nextState.statusCounts;
    }

    function getOpenItemsCount(): number {
        return getOpenItemsCountMetric(assignments);
    }

    function getOverdueCount(): number {
        return getOverdueCountMetric(assignments);
    }

    function getDueSoonCount(): number {
        return getDueSoonCountMetric(assignments);
    }

    function getAssignedHours(): number {
        return getAssignedHoursMetric(assignments);
    }

    function getAssignedBudgetTotal(): number {
        return getAssignedBudgetTotalMetric(assignments);
    }

    function getCompletionRate(): number {
        return calculateCompletionRateMetric(assignments);
    }

    function getPortfolioHealth(): number {
        return calculatePortfolioHealthMetric(projectSnapshots, userProjects.length);
    }

    function getStatusLabel(status: WorkStatus): string {
        if (status === "To Do") return $t.taskStatus.toDo;
        if (status === "In Progress") return $t.taskStatus.inProgress;
        if (status === "Done") return $t.taskStatus.done;
        return $t.taskStatus.pending;
    }

    function getStatusClasses(status: WorkStatus): string {
        if (status === "Done") return "bg-green-100 text-green-700";
        if (status === "In Progress") return "bg-orange-100 text-orange-700";
        if (status === "To Do") return "bg-blue-100 text-blue-700";
        return "bg-gray-200 text-gray-700";
    }

    function getProjectTone(project: ProjectSnapshot): string {
        if (project.overdueItems > 0 || project.budgetUsage > 100) return "border-red-200 bg-red-50/80";
        if (!project.onTrack || project.budgetUsage > 80) return "border-orange-200 bg-orange-50/80";
        return "border-gray-200 bg-white";
    }

    function getProjectIndicator(project: ProjectSnapshot): string {
        if (project.overdueItems > 0 || project.budgetUsage > 100) return "bg-red-500";
        if (!project.onTrack || project.budgetUsage > 80) return "bg-orange-500";
        return "bg-green-500";
    }

    function getTimelineLabel(item: Assignment): string {
        if (!item.dueDate) return "-";

        const diff = getTimelineDayDiffLabel(item.dueDate, new Date());
        if (diff == null) return dueDateLabel(item.dueDate);
        if (diff < 0) return `${$t.home.overdueByDays} ${Math.abs(diff)}`;
        if (diff === 0) return $t.home.dueToday;
        return `${$t.home.dueInDays} ${diff}`;
    }

    function getWorkloadWidth(count: number): string {
        if (assignments.length === 0) return "0%";
        return `${(count / assignments.length) * 100}%`;
    }

    function formatHours(hours: number): string {
        if (hours < 24) return `${hours.toFixed(1)}h`;
        return `${(hours / 8).toFixed(1)} ${$t.common.days} (${hours.toFixed(0)}h)`;
    }

    function openAssignmentDrilldown(item: Assignment) {
        selectedAssignment = item;
        assignmentDrilldownOpen = true;
    }

    function closeAssignmentDrilldown() {
        assignmentDrilldownOpen = false;
        selectedAssignment = null;
    }

    function openProjectDrilldown(snapshot: ProjectSnapshot) {
        selectedSnapshot = snapshot;
        projectDrilldownOpen = true;
    }

    function closeProjectDrilldown() {
        projectDrilldownOpen = false;
        selectedSnapshot = null;
    }

    function changeAssignmentStatus(id: string, status: WorkStatus) {
        updateAssignmentStatus(id, status);
    }

    const unsubscribeProjects = projectList.subscribe((value) => {
        projects = value;
        buildDashboard();
    });
    const unsubscribeCurrentUser = currentUser.subscribe(() => {
        buildDashboard();
    });

    onMount(() => {
        return () => {
            unsubscribeProjects();
            unsubscribeCurrentUser();
        };
    });
</script>

<div class="min-h-screen bg-gray-50">
    <div class="mx-auto flex max-w-7xl flex-col gap-6 p-6">
        <section class="overflow-hidden rounded-4xl border border-gray-200 bg-white shadow-sm">
            <div class="grid gap-6 p-6 lg:grid-cols-[1.5fr_0.9fr] lg:p-8">
                <div class="flex items-start gap-4">
                    <div class="flex h-18 w-18 shrink-0 items-center justify-center rounded-3xl bg-blue-100 text-2xl font-semibold text-blue-600">
                        {getUserInitials($currentUser.firstName, $currentUser.lastName)}
                    </div>
                    <div class="space-y-3">
                        <p class="text-sm uppercase tracking-[0.24em] text-blue-600">{$t.home.title}</p>
                        <div>
                            <h1 class="text-3xl font-bold tracking-tight text-gray-900 lg:text-4xl">
                                {$currentUser.firstName} {$currentUser.lastName}
                            </h1>
                            <p class="mt-2 max-w-2xl text-sm text-gray-600 lg:text-base">{$t.home.subtitle}</p>
                        </div>
                        <div class="flex flex-wrap gap-3 text-sm text-gray-700">
                            <span class="rounded-full border border-gray-200 bg-blue-50 px-3 py-1.5 text-blue-700">{$currentUser.jobTitle}</span>
                            <span class="rounded-full border border-gray-200 bg-purple-50 px-3 py-1.5 text-purple-700">{$currentUser.department}</span>
                            <span class="rounded-full border border-gray-200 bg-gray-100 px-3 py-1.5 text-gray-700">{$currentUser.email}</span>
                        </div>
                    </div>
                </div>

                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <div class="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div class="flex items-start justify-between gap-4">
                            <div>
                                <p class="text-xs uppercase tracking-[0.2em] text-blue-600">{$t.home.completionRate}</p>
                                <div class="mt-3 flex items-end justify-between gap-4">
                                    <p class="text-4xl font-bold text-gray-900">{getCompletionRate().toFixed(0)}%</p>
                                    <p class="text-sm text-gray-600">{$t.home.currentAssignments}: {assignments.length}</p>
                                </div>
                            </div>
                            <div class="rounded-full bg-blue-100 p-3">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5-1a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div class="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div class="flex items-start justify-between gap-4">
                            <div>
                                <p class="text-xs uppercase tracking-[0.2em] text-green-600">{$t.home.healthyPortfolio}</p>
                                <div class="mt-3 flex items-end justify-between gap-4">
                                    <p class="text-4xl font-bold text-gray-900">{getPortfolioHealth().toFixed(0)}%</p>
                                    <p class="text-sm text-gray-600">{$t.home.activeProjects}: {userProjects.length}</p>
                                </div>
                            </div>
                            <div class="rounded-full bg-green-100 p-3">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622C17.176 19.29 21 14.591 21 9c0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <p class="text-sm font-medium text-gray-500">{$t.home.activeProjects}</p>
                        <div class="mt-3 flex items-end gap-3">
                            <p class="text-4xl font-bold text-gray-900">{userProjects.length}</p>
                            <span class="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">{$t.home.openItems}: {getOpenItemsCount()}</span>
                        </div>
                    </div>
                    <div class="rounded-full bg-blue-100 p-3">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7h18M6 11h12M9 15h6M4 21h16a1 1 0 001-1V4a1 1 0 00-1-1H4a1 1 0 00-1 1v16a1 1 0 001 1z" />
                        </svg>
                    </div>
                </div>
            </article>

            <article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <p class="text-sm font-medium text-gray-500">{$t.home.overdueItems}</p>
                        <div class="mt-3 flex items-end gap-3">
                            <p class="text-4xl font-bold text-red-700">{getOverdueCount()}</p>
                            <span class="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">{$t.home.focus}</span>
                        </div>
                    </div>
                    <div class="rounded-full bg-red-100 p-3">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-7.938 4h15.876c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L2.33 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                </div>
            </article>

            <article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <p class="text-sm font-medium text-gray-500">{$t.home.dueThisWeek}</p>
                        <div class="mt-3 flex items-end gap-3">
                            <p class="text-4xl font-bold text-orange-700">{getDueSoonCount()}</p>
                            <span class="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">{$t.home.nextAssignments}</span>
                        </div>
                    </div>
                    <div class="rounded-full bg-orange-100 p-3">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                </div>
            </article>

            <article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <p class="text-sm font-medium text-gray-500">{$t.home.assignedBudget}</p>
                <p class="mt-2 text-2xl font-semibold text-gray-900">{formatBudget(getAssignedBudgetTotal())}</p>
                <p class="mt-1 text-sm text-gray-500">{formatHours(getAssignedHours())}</p>
            </article>
        </section>

        <section class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <h2 class="text-xl font-semibold text-gray-900">{$t.home.workloadStatus}</h2>
                        <p class="mt-1 text-sm text-gray-500">{$t.home.currentAssignments}: {assignments.length}</p>
                    </div>
                    <p class="text-3xl font-bold text-purple-600">{getCompletionRate().toFixed(0)}%</p>
                </div>

                <div class="mt-5 h-3 overflow-hidden rounded-full bg-gray-200">
                    <div class="flex h-full w-full overflow-hidden rounded-full">
                        <div class="bg-gray-400" style={`width: ${getWorkloadWidth(statusCounts.Pending)}`}></div>
                        <div class="bg-blue-500" style={`width: ${getWorkloadWidth(statusCounts["To Do"])}`}></div>
                        <div class="bg-orange-400" style={`width: ${getWorkloadWidth(statusCounts["In Progress"])}`}></div>
                        <div class="bg-green-500" style={`width: ${getWorkloadWidth(statusCounts.Done)}`}></div>
                    </div>
                </div>

                <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div class="rounded-2xl bg-gray-100 p-4">
                        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{$t.taskStatus.pending}</p>
                        <p class="mt-2 text-2xl font-bold text-gray-900">{statusCounts.Pending}</p>
                    </div>
                    <div class="rounded-2xl bg-blue-100 p-4">
                        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">{$t.taskStatus.toDo}</p>
                        <p class="mt-2 text-2xl font-bold text-blue-800">{statusCounts["To Do"]}</p>
                    </div>
                    <div class="rounded-2xl bg-orange-100 p-4">
                        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">{$t.taskStatus.inProgress}</p>
                        <p class="mt-2 text-2xl font-bold text-orange-800">{statusCounts["In Progress"]}</p>
                    </div>
                    <div class="rounded-2xl bg-green-100 p-4">
                        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">{$t.taskStatus.done}</p>
                        <p class="mt-2 text-2xl font-bold text-green-800">{statusCounts.Done}</p>
                    </div>
                </div>
            </article>

            <article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 class="text-xl font-semibold text-gray-900">{$t.home.quickActions}</h2>
                <div class="mt-5 grid gap-3">
                    <a href="/projects" class="rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm font-semibold text-gray-900 transition hover:border-gray-300 hover:bg-gray-50">
                        {$t.home.openProjects}
                    </a>
                    <a href="/projects?new=1" class="rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm font-semibold text-gray-900 transition hover:border-gray-300 hover:bg-gray-50">
                        {$t.home.createProject}
                    </a>
                    <a href="/admin" class="rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm font-semibold text-gray-900 transition hover:border-gray-300 hover:bg-gray-50">
                        {$t.home.manageRates}
                    </a>
                    <a href="/settings" class="rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm font-semibold text-gray-900 transition hover:border-gray-300 hover:bg-gray-50">
                        {$t.home.openSettings}
                    </a>
                </div>
            </article>
        </section>

        <section class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <h2 class="text-xl font-semibold text-gray-900">{$t.home.nextAssignments}</h2>
                        <p class="mt-1 text-sm text-gray-500">{$t.home.focus}</p>
                    </div>
                    <span class="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">{priorityAssignments.length}</span>
                </div>

                {#if priorityAssignments.length > 0}
                    <div class="mt-5 max-h-120 overflow-y-auto space-y-3 pr-1">
                        {#each priorityAssignments as item (item.id)}
                            <button
                                class="w-full rounded-2xl border border-gray-200 p-4 text-left transition hover:border-blue-200 hover:bg-gray-50"
                                onclick={() => openAssignmentDrilldown(item)}
                            >
                                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div class="space-y-2">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <span class={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(item.status)}`}>
                                                {getStatusLabel(item.status)}
                                            </span>
                                            <span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                                                {item.kind === "task" ? $t.home.itemTypeTask : $t.home.itemTypeSubtask}
                                            </span>
                                        </div>
                                        <div>
                                            <p class="text-base font-semibold text-gray-900">{item.title}</p>
                                            <p class="text-sm text-gray-500">{item.projectTitle}</p>
                                        </div>
                                    </div>

                                    <div class="grid gap-2 text-sm text-gray-600 sm:grid-cols-3 lg:min-w-84">
                                        <div>
                                            <p class="text-xs uppercase tracking-[0.15em] text-gray-400">{$t.projects.dueDate}</p>
                                            <p class="mt-1 font-medium text-gray-800">{item.dueDate ? dueDateLabel(item.dueDate) : "-"}</p>
                                            <p class={`mt-1 text-xs font-semibold ${item.isOverdue ? "text-red-600" : item.isDueSoon ? "text-orange-600" : "text-gray-500"}`}>
                                                {getTimelineLabel(item)}
                                            </p>
                                        </div>
                                        <div>
                                            <p class="text-xs uppercase tracking-[0.15em] text-gray-400">{$t.common.hours}</p>
                                            <p class="mt-1 font-medium text-gray-800">{formatHours(item.estimatedHours)}</p>
                                        </div>
                                        <div>
                                            <p class="text-xs uppercase tracking-[0.15em] text-gray-400">{$t.common.cost}</p>
                                            <p class="mt-1 font-medium text-gray-900">{formatBudget(item.cost)}</p>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        {/each}
                    </div>
                {:else}
                    <div class="mt-5 rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
                        {$t.home.noAssignments}
                    </div>
                {/if}
            </article>

            <article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <h2 class="text-xl font-semibold text-gray-900">{$t.home.projectHealth}</h2>
                        <p class="mt-1 text-sm text-gray-500">{$t.home.activeProjects}: {userProjects.length}</p>
                    </div>
                </div>

                {#if projectSnapshots.length > 0}
                    <div class="mt-5 max-h-120 overflow-y-auto space-y-3 pr-1">
                        {#each projectSnapshots as snapshot (snapshot.project.projectID)}
                            <button
                                class={`w-full rounded-2xl border p-4 text-left ${getProjectTone(snapshot)}`}
                                onclick={() => openProjectDrilldown(snapshot)}
                            >
                                <div class="flex items-start gap-3">
                                    <span class={`mt-1 h-3 w-3 shrink-0 rounded-full ${getProjectIndicator(snapshot)}`}></span>
                                    <div class="min-w-0 flex-1">
                                        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p class="truncate text-base font-semibold text-gray-900">{snapshot.project.title}</p>
                                                <p class="text-sm text-gray-600">{snapshot.project.customerName}</p>
                                            </div>
                                            <span class={`rounded-full px-3 py-1 text-xs font-semibold ${snapshot.onTrack ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-800"}`}>
                                                {snapshot.onTrack ? $t.home.healthyPortfolio : $t.home.needsAttention}
                                            </span>
                                        </div>

                                        <div class="mt-4 grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
                                            <div>
                                                <p class="text-xs uppercase tracking-[0.15em] text-gray-400">{$t.projects.currentPhase}</p>
                                                <p class="mt-1 font-medium">{snapshot.phase}</p>
                                            </div>
                                            <div>
                                                <p class="text-xs uppercase tracking-[0.15em] text-gray-400">{$t.projects.dueDate}</p>
                                                <p class="mt-1 font-medium">{snapshot.dueDate ? dueDateLabel(snapshot.dueDate) : "-"}</p>
                                            </div>
                                            <div>
                                                <p class="text-xs uppercase tracking-[0.15em] text-gray-400">{$t.home.openItems}</p>
                                                <p class="mt-1 font-medium">{snapshot.openItems}</p>
                                            </div>
                                            <div>
                                                <p class="text-xs uppercase tracking-[0.15em] text-gray-400">{$t.home.overdueItems}</p>
                                                <p class="mt-1 font-medium">{snapshot.overdueItems}</p>
                                            </div>
                                        </div>

                                        <div class="mt-4">
                                            <div class="mb-2 flex items-center justify-between text-sm">
                                                <p class="font-medium text-gray-700">{$t.projects.budgetUsage}</p>
                                                <p class={`font-semibold ${snapshot.budgetUsage > 100 ? "text-red-700" : "text-green-700"}`}>
                                                    {snapshot.budgetUsage.toFixed(1)}%
                                                </p>
                                            </div>
                                            <div class="h-2.5 overflow-hidden rounded-full bg-gray-200">
                                                <div
                                                    class={`h-full rounded-full ${snapshot.budgetUsage > 100 ? "bg-red-500" : "bg-green-500"}`}
                                                    style={`width: ${Math.min(snapshot.budgetUsage, 100)}%`}
                                                ></div>
                                            </div>
                                            <p class="mt-2 text-xs text-gray-500">{$t.projects.reserve}: {formatBudget(snapshot.reserveBudget)}</p>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        {/each}
                    </div>
                {:else}
                    <div class="mt-5 rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
                        {$t.home.noProjects}
                    </div>
                {/if}
            </article>
        </section>
    </div>
</div>

{#if assignmentDrilldownOpen && selectedAssignment}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button class="absolute inset-0 bg-black/35" aria-label="Close assignment details" onclick={closeAssignmentDrilldown}></button>
        <div class="relative w-full max-w-2xl rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div class="mb-4 flex items-start justify-between gap-4">
                <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">{$t.home.nextAssignments}</p>
                    <h3 class="mt-1 text-xl font-bold text-gray-900">{selectedAssignment.title}</h3>
                    <p class="text-sm text-gray-500">{selectedAssignment.projectTitle}</p>
                </div>
                <button class="rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-gray-600" onclick={closeAssignmentDrilldown}>{$t.common.close}</button>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
                <div class="rounded-2xl bg-gray-50 p-4">
                    <p class="text-xs uppercase tracking-wide text-gray-400">{$t.common.status}</p>
                    <div class="mt-2 flex items-center gap-2">
                        <span class={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(selectedAssignment.status)}`}>
                            {getStatusLabel(selectedAssignment.status)}
                        </span>
                        <select
                            value={selectedAssignment.status}
                            onchange={(e) => {
                                if (!selectedAssignment) return;
                                changeAssignmentStatus(selectedAssignment.id, (e.currentTarget as HTMLSelectElement).value as WorkStatus);
                            }}
                            class="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700"
                        >
                            <option value="Pending">{$t.taskStatus.pending}</option>
                            <option value="To Do">{$t.taskStatus.toDo}</option>
                            <option value="In Progress">{$t.taskStatus.inProgress}</option>
                            <option value="Done">{$t.taskStatus.done}</option>
                        </select>
                    </div>
                </div>
                <div class="rounded-2xl bg-gray-50 p-4">
                    <p class="text-xs uppercase tracking-wide text-gray-400">{$t.projects.dueDate}</p>
                    <p class="mt-2 text-sm font-semibold text-gray-800">{selectedAssignment.dueDate ? dueDateLabel(selectedAssignment.dueDate) : "-"}</p>
                    <p class={`mt-1 text-xs font-semibold ${selectedAssignment.isOverdue ? "text-red-600" : selectedAssignment.isDueSoon ? "text-orange-600" : "text-gray-500"}`}>
                        {getTimelineLabel(selectedAssignment)}
                    </p>
                </div>
                <div class="rounded-2xl bg-gray-50 p-4">
                    <p class="text-xs uppercase tracking-wide text-gray-400">{$t.common.hours}</p>
                    <p class="mt-2 text-sm font-semibold text-gray-800">{formatHours(selectedAssignment.estimatedHours)}</p>
                </div>
                <div class="rounded-2xl bg-gray-50 p-4">
                    <p class="text-xs uppercase tracking-wide text-gray-400">{$t.common.cost}</p>
                    <p class="mt-2 text-sm font-semibold text-gray-800">{formatBudget(selectedAssignment.cost)}</p>
                </div>
            </div>
        </div>
    </div>
{/if}

{#if projectDrilldownOpen && selectedSnapshot}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button class="absolute inset-0 bg-black/35" aria-label="Close project details" onclick={closeProjectDrilldown}></button>
        <div class="relative w-full max-w-3xl rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div class="mb-4 flex items-start justify-between gap-4">
                <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-green-600">{$t.home.projectHealth}</p>
                    <h3 class="mt-1 text-xl font-bold text-gray-900">{selectedSnapshot.project.title}</h3>
                    <p class="text-sm text-gray-500">{selectedSnapshot.project.customerName}</p>
                </div>
                <button class="rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-gray-600" onclick={closeProjectDrilldown}>{$t.common.close}</button>
            </div>

            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div class="rounded-2xl bg-gray-50 p-4">
                    <p class="text-xs uppercase tracking-wide text-gray-400">{$t.projects.currentPhase}</p>
                    <p class="mt-2 text-sm font-semibold text-gray-800">{selectedSnapshot.phase}</p>
                </div>
                <div class="rounded-2xl bg-gray-50 p-4">
                    <p class="text-xs uppercase tracking-wide text-gray-400">{$t.projects.dueDate}</p>
                    <p class="mt-2 text-sm font-semibold text-gray-800">{selectedSnapshot.dueDate ? dueDateLabel(selectedSnapshot.dueDate) : "-"}</p>
                </div>
                <div class="rounded-2xl bg-gray-50 p-4">
                    <p class="text-xs uppercase tracking-wide text-gray-400">{$t.home.openItems}</p>
                    <p class="mt-2 text-sm font-semibold text-gray-800">{selectedSnapshot.openItems}</p>
                </div>
                <div class="rounded-2xl bg-gray-50 p-4">
                    <p class="text-xs uppercase tracking-wide text-gray-400">{$t.home.overdueItems}</p>
                    <p class="mt-2 text-sm font-semibold text-gray-800">{selectedSnapshot.overdueItems}</p>
                </div>
            </div>

            <div class="mt-4 rounded-2xl border border-gray-200 p-4">
                <div class="mb-2 flex items-center justify-between text-sm">
                    <p class="font-medium text-gray-700">{$t.projects.budgetUsage}</p>
                    <p class={`font-semibold ${selectedSnapshot.budgetUsage > 100 ? "text-red-700" : "text-green-700"}`}>
                        {selectedSnapshot.budgetUsage.toFixed(1)}%
                    </p>
                </div>
                <div class="h-2.5 overflow-hidden rounded-full bg-gray-200">
                    <div
                        class={`h-full rounded-full ${selectedSnapshot.budgetUsage > 100 ? "bg-red-500" : "bg-green-500"}`}
                        style={`width: ${Math.min(selectedSnapshot.budgetUsage, 100)}%`}
                    ></div>
                </div>
                <p class="mt-2 text-xs text-gray-500">{$t.projects.reserve}: {formatBudget(selectedSnapshot.reserveBudget)}</p>
            </div>
        </div>
    </div>
{/if}
