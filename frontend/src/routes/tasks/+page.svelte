<script lang="ts">
    import { onMount } from "svelte";
    import {
        projectList,
        setAssignmentHoursFromLogged,
        updateAssignmentMeta,
        updateAssignmentStatus,
    } from "$lib/modules/projects/store";
    import { companyEmployeeList } from "$lib/modules/projects/dataSource.mock";
    import type { Project } from "$lib/modules/projects/contracts";
    import {
        buildDashboardState,
        calculateCompletionRate as calcCompletionRate,
        getOpenItemsCount as getOpenCount,
        getOverdueCount as getOverdueCount,
        getDueSoonCount as getDueSoonCount,
        getAssignedHours as getAssignedHours,
        getAssignedBudgetTotal as getAssignedBudget,
        getTimelineDayDiffLabel,
    } from "$lib/modules/dashboard/business";
    import type { WorkStatus, Assignment } from "$lib/modules/dashboard/contracts";
    import { dueDateLabel, formatBudget } from "$lib/utils/format";
    import { loadHourlyRates } from "$lib/modules/projects/rates";
    import { t } from "$lib/language";
    import { currentUser } from "$lib/modules/user/store";
    import { taskNotifications } from "$lib/state/notifications/taskNotifications.store";
    import { workLogStore } from "$lib/state/tasks/worklog.store";

    // ── Types ────────────────────────────────────────────────────────────────
    interface RuntimeWindow {
        start: Date | null;
        end: Date | null;
    }

    // ── Core state ───────────────────────────────────────────────────────────
    let projects = $state<Project[]>([]);
    let assignments = $state<Assignment[]>([]);
    let hourlyRates = $state(loadHourlyRates());
    let statusCounts = $state<Record<WorkStatus, number>>({
        Pending: 0,
        "To Do": 0,
        "In Progress": 0,
        Done: 0,
    });

    // ── Filter state ─────────────────────────────────────────────────────────
    let statusFilter = $state<WorkStatus | "">("");
    let searchText = $state("");

    // ── Detail panel state ───────────────────────────────────────────────────
    let selectedId = $state<string | null>(null);
    let detailTab = $state<"worklog" | "chat">("worklog");
    let dayModalOpen = $state(false);
    let dayModalDate = $state<Date | null>(null);
    let assignmentModalOpen = $state(false);
    let assignmentModalId = $state<string | null>(null);
    let assignmentTab = $state<"stats" | "worklog" | "chat">("stats");
    let assignmentCriticalDraft = $state(false);
    let assignmentRiskDraft = $state("");

    // ── Work log state ───────────────────────────────────────────────────────
    let wDate = $state(new Date().toISOString().split("T")[0]);
    let wHours = $state<number>(1);
    let wDesc = $state("");

    // ── Chat state ───────────────────────────────────────────────────────────
    let msgText = $state("");
    let msgTo = $state("");

    // ── Calendar state ───────────────────────────────────────────────────────
    function stripTime(d: Date | null): Date | null {
        if (!d) return null;
        const n = new Date(d);
        n.setHours(0, 0, 0, 0);
        return n;
    }

    function ymd(d: Date): string {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    function findRuntime(a: Assignment): RuntimeWindow {
        const parts = a.id.split("-");
        const projectId = Number(parts[1]);
        const taskId = Number(parts[2]);
        const project = projects.find((p) => p.projectID === projectId);
        const task = project?.Tasks?.find((t) => t.taskID === taskId);

        if (a.kind === "task") {
            const start = stripTime(task?.startDate ? new Date(task.startDate) : null);
            const end = stripTime(task?.dueDate ? new Date(task.dueDate) : a.dueDate);
            if (!start && !end) return { start: null, end: null };
            return { start: start ?? end, end: end ?? start };
        }

        const subtaskId = Number(parts[3]);
        const subtask = task?.subtasks?.find((s) => s.subtaskID === subtaskId);
        const start = stripTime(
            subtask?.startDate
                ? new Date(subtask.startDate)
                : task?.startDate
                    ? new Date(task.startDate)
                    : null,
        );
        const end = stripTime(
            subtask?.dueDate
                ? new Date(subtask.dueDate)
                : task?.dueDate
                    ? new Date(task.dueDate)
                    : a.dueDate,
        );
        if (!start && !end) return { start: null, end: null };
        return { start: start ?? end, end: end ?? start };
    }

    let runtimeById = $derived.by(() => {
        const map = new Map<string, RuntimeWindow>();
        for (const a of assignments) {
            map.set(a.id, findRuntime(a));
        }
        return map;
    });

    const now = new Date();
    let monthAnchor = $state<Date>(new Date(now.getFullYear(), now.getMonth(), 1));

    let monthDays = $derived.by(() => {
        const first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
        const firstWeekdayMondayBased = (first.getDay() + 6) % 7;
        const gridStart = new Date(first);
        gridStart.setDate(first.getDate() - firstWeekdayMondayBased);

        return Array.from({ length: 42 }, (_, i) => {
            const d = new Date(gridStart);
            d.setDate(gridStart.getDate() + i);
            return d;
        });
    });

    let monthLabel = $derived(monthAnchor.toLocaleDateString(undefined, { month: "long", year: "numeric" }));

    // ── Derived UI state ─────────────────────────────────────────────────────
    let filtered = $derived(
        assignments.filter((a) => {
            if (statusFilter && a.status !== statusFilter) return false;
            const q = searchText.trim().toLowerCase();
            return !q || a.title.toLowerCase().includes(q) || a.projectTitle.toLowerCase().includes(q);
        })
    );

    let selEntries = $derived(selectedId ? $workLogStore.filter((w) => w.assignmentId === selectedId) : []);
    let userFullName = $derived(`${$currentUser.firstName} ${$currentUser.lastName}`);
    let selMsgs = $derived(
        selectedId
            ? $taskNotifications.filter(
                (m) => m.assignmentId === selectedId && (m.to === userFullName || m.from === userFullName),
            )
            : [],
    );
    let loggedTotal = $derived(selEntries.reduce((s, w) => s + w.hours, 0));
    let dayModalItems = $derived(dayModalDate ? dayAssignments(dayModalDate) : []);
    let assignmentModalItem = $derived(
        assignmentModalId ? assignments.find((a) => a.id === assignmentModalId) ?? null : null,
    );
    let assignmentModalEntries = $derived(
        assignmentModalId ? $workLogStore.filter((w) => w.assignmentId === assignmentModalId) : [],
    );
    let assignmentModalMsgs = $derived(
        assignmentModalId
            ? $taskNotifications.filter(
                (m) => m.assignmentId === assignmentModalId && (m.to === userFullName || m.from === userFullName),
            )
            : [],
    );
    let assignmentModalLoggedTotal = $derived(assignmentModalEntries.reduce((s, w) => s + w.hours, 0));
    let selectedRuntime = $derived(selectedId ? (runtimeById.get(selectedId) ?? null) : null);
    let assignmentModalRuntime = $derived(assignmentModalId ? (runtimeById.get(assignmentModalId) ?? null) : null);
    let minWorkDate = $derived(selectedRuntime?.start ? ymd(selectedRuntime.start) : "");
    let maxWorkDate = $derived(selectedRuntime?.end ? ymd(selectedRuntime.end) : "");
    let modalMinWorkDate = $derived(assignmentModalRuntime?.start ? ymd(assignmentModalRuntime.start) : "");
    let modalMaxWorkDate = $derived(assignmentModalRuntime?.end ? ymd(assignmentModalRuntime.end) : "");

    let colleagues = $derived(
        companyEmployeeList
            .filter((e) => e.employeeID !== $currentUser.employeeID)
            .map((e) => `${e.firstName} ${e.lastName}`)
    );

    $effect(() => {
        if (colleagues.length > 0 && !msgTo) msgTo = colleagues[0];
    });

    // ── Build dashboard state ────────────────────────────────────────────────
    function build() {
        hourlyRates = loadHourlyRates();
        const state = buildDashboardState(
            projects,
            `${$currentUser.firstName} ${$currentUser.lastName}`,
            hourlyRates,
        );
        assignments = state.assignments;
        statusCounts = state.statusCounts;
    }

    const u1 = projectList.subscribe((v) => { projects = v; build(); });
    const u2 = currentUser.subscribe(() => build());
    onMount(() => () => { u1(); u2(); });

    // ── Calendar helpers ─────────────────────────────────────────────────────
    function isToday(d: Date): boolean {
        const n = new Date();
        return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
    }

    function isCurrentMonth(d: Date): boolean {
        return d.getMonth() === monthAnchor.getMonth() && d.getFullYear() === monthAnchor.getFullYear();
    }

    function prevMonth() {
        monthAnchor = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1);
    }

    function nextMonth() {
        monthAnchor = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1);
    }

    function dayAssignments(day: Date): Assignment[] {
        const d = stripTime(day);
        if (!d) return [];
        return assignments.filter((a) => {
            const runtime = runtimeById.get(a.id);
            if (!runtime) return false;
            const start = runtime.start;
            const end = runtime.end;
            if (!start && !end) return false;
            const from = start ?? end;
            const to = end ?? start;
            if (!from || !to) return false;
            return d >= from && d <= to;
        });
    }

    function chipColor(a: Assignment): string {
        if (a.status === "Done") return "bg-green-100 text-green-700 border-green-200";
        if (a.isOverdue) return "bg-red-100 text-red-700 border-red-200";
        if (a.isDueSoon) return "bg-orange-100 text-orange-700 border-orange-200";
        return "bg-blue-100 text-blue-700 border-blue-200";
    }

    // ── Per-item badge counts (access $state → reactive in template) ─────────
    function entryHours(id: string): number {
        return $workLogStore.filter((w) => w.assignmentId === id).reduce((s, w) => s + w.hours, 0);
    }

    function msgCount(id: string): number {
        return $taskNotifications.filter(
            (m) => m.assignmentId === id && (m.to === userFullName || m.from === userFullName),
        ).length;
    }

    function totalLoggedFor(assignmentId: string, excludeEntryId?: string): number {
        return $workLogStore
            .filter((w) => w.assignmentId === assignmentId && (!excludeEntryId || w.id !== excludeEntryId))
            .reduce((s, w) => s + w.hours, 0);
    }

    function getAssignmentMeta(assignmentId: string): { isCritical: boolean; riskNote: string } {
        const parts = assignmentId.split("-");
        const kind = parts[0];
        const projectId = Number(parts[1]);
        const taskId = Number(parts[2]);

        if (!Number.isFinite(projectId) || !Number.isFinite(taskId)) {
            return { isCritical: false, riskNote: "" };
        }

        const project = projects.find((p) => p.projectID === projectId);
        const task = project?.Tasks?.find((t) => t.taskID === taskId);
        if (!task) return { isCritical: false, riskNote: "" };

        if (kind === "task") {
            return {
                isCritical: task.isCritical ?? false,
                riskNote: task.riskNote ?? "",
            };
        }

        if (kind === "subtask") {
            const subtaskId = Number(parts[3]);
            if (!Number.isFinite(subtaskId)) return { isCritical: false, riskNote: "" };
            const subtask = task.subtasks?.find((s) => s.subtaskID === subtaskId);
            return {
                isCritical: subtask?.isCritical ?? false,
                riskNote: subtask?.riskNote ?? "",
            };
        }

        return { isCritical: false, riskNote: "" };
    }

    // ── Actions ──────────────────────────────────────────────────────────────
    function selectItem(id: string) {
        if (selectedId === id) {
            selectedId = null;
        } else {
            selectedId = id;
            detailTab = "worklog";
        }
    }

    function openDayDrilldown(day: Date, focusItemId?: string) {
        dayModalDate = new Date(day);
        dayModalOpen = true;
        if (focusItemId) {
            selectedId = focusItemId;
            detailTab = "worklog";
        }
    }

    function closeDayDrilldown() {
        dayModalOpen = false;
        dayModalDate = null;
    }

    function openAssignmentModal(id: string) {
        assignmentModalId = id;
        assignmentModalOpen = true;
        assignmentTab = "stats";
        selectedId = id;
    }

    function closeAssignmentModal() {
        assignmentModalOpen = false;
        assignmentModalId = null;
    }

    function saveAssignmentMeta() {
        if (!assignmentModalItem) return;
        updateAssignmentMeta(assignmentModalItem.id, {
            isCritical: assignmentCriticalDraft,
            riskNote: assignmentRiskDraft.trim(),
        });
    }

    function addEntry() {
        const targetId = assignmentModalOpen && assignmentModalId ? assignmentModalId : selectedId;
        if (!targetId || !wDesc.trim() || wHours <= 0) return;

        const runtime = runtimeById.get(targetId);
        const minDate = runtime?.start ? ymd(runtime.start) : "";
        const maxDate = runtime?.end ? ymd(runtime.end) : "";
        if (minDate && wDate < minDate) return;
        if (maxDate && wDate > maxDate) return;

        workLogStore.addEntry({
            assignmentId: targetId,
            date: wDate,
            hours: Number(wHours),
            description: wDesc.trim(),
            author: `${$currentUser.firstName} ${$currentUser.lastName}`,
        });

        const updatedTotal = totalLoggedFor(targetId) + Number(wHours);
        setAssignmentHoursFromLogged(targetId, updatedTotal);

        wDesc = "";
        wHours = 1;
        wDate = new Date().toISOString().split("T")[0];
    }

    function removeEntry(id: string) {
        const removed = $workLogStore.find((entry) => entry.id === id);
        workLogStore.removeEntry(id);
        if (removed) {
            const remaining = totalLoggedFor(removed.assignmentId, id);
            setAssignmentHoursFromLogged(removed.assignmentId, remaining);
        }
    }

    function changeStatus(assignmentId: string, status: WorkStatus) {
        updateAssignmentStatus(assignmentId, status);
    }

    function sendMsg() {
        const targetId = assignmentModalOpen && assignmentModalId ? assignmentModalId : selectedId;
        if (!targetId || !msgText.trim() || !msgTo) return;

        const item = assignments.find((a) => a.id === targetId);
        taskNotifications.addMessage({
            assignmentId: targetId,
            assignmentTitle: item?.title ?? "-",
            projectTitle: item?.projectTitle ?? "-",
            from: `${$currentUser.firstName} ${$currentUser.lastName}`,
            to: msgTo,
            text: msgText.trim(),
        });
        msgText = "";
    }

    // ── Format helpers ───────────────────────────────────────────────────────
    function fmtH(h: number): string {
        if (h < 24) return `${h.toFixed(1)}h`;
        return `${(h / 8).toFixed(1)} ${$t.common.days} (${h.toFixed(0)}h)`;
    }

    function statusLabel(s: WorkStatus): string {
        if (s === "To Do") return $t.taskStatus.toDo;
        if (s === "In Progress") return $t.taskStatus.inProgress;
        if (s === "Done") return $t.taskStatus.done;
        return $t.taskStatus.pending;
    }

    function statusCls(s: WorkStatus): string {
        if (s === "Done") return "bg-green-100 text-green-700";
        if (s === "In Progress") return "bg-orange-100 text-orange-700";
        if (s === "To Do") return "bg-blue-100 text-blue-700";
        return "bg-gray-200 text-gray-700";
    }

    function timelineLabel(a: Assignment): string {
        if (!a.dueDate) return "-";
        const diff = getTimelineDayDiffLabel(a.dueDate, new Date());
        if (diff == null) return dueDateLabel(a.dueDate);
        if (diff < 0) return `${$t.home.overdueByDays} ${Math.abs(diff)}`;
        if (diff === 0) return $t.home.dueToday;
        return `${$t.home.dueInDays} ${diff}`;
    }

    function wWidth(n: number): string {
        return assignments.length === 0 ? "0%" : `${(n / assignments.length) * 100}%`;
    }

    function fmtAt(d: Date | string): string {
        const v = typeof d === "string" ? new Date(d) : d;
        return v.toLocaleString(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    }

    function fmtDateLong(d: Date): string {
        return d.toLocaleDateString(undefined, {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
        });
    }

    $effect(() => {
        if (!selectedRuntime) return;
        if (minWorkDate && wDate < minWorkDate) wDate = minWorkDate;
        if (maxWorkDate && wDate > maxWorkDate) wDate = maxWorkDate;
    });

    $effect(() => {
        if (!assignmentModalRuntime) return;
        if (modalMinWorkDate && wDate < modalMinWorkDate) wDate = modalMinWorkDate;
        if (modalMaxWorkDate && wDate > modalMaxWorkDate) wDate = modalMaxWorkDate;
    });

    $effect(() => {
        if (!assignmentModalItem) return;
        const meta = getAssignmentMeta(assignmentModalItem.id);
        assignmentCriticalDraft = meta.isCritical;
        assignmentRiskDraft = meta.riskNote;
    });
</script>

<div class="min-h-screen bg-gray-50 font-sans">
    <div class="mx-auto flex max-w-7xl flex-col gap-6 p-6">

        <!-- Header -->
        <section class="overflow-hidden rounded-4xl border border-gray-200 bg-white shadow-sm">
            <div class="p-6 lg:p-8">
                <p class="text-sm uppercase tracking-[0.24em] text-blue-600">{$t.nav.tasks}</p>
                <h1 class="mt-2 text-3xl font-bold tracking-tight text-gray-900">{$t.home.nextAssignments}</h1>
                <p class="mt-1 text-sm text-gray-500">{$t.home.currentAssignments}: {assignments.length}</p>
            </div>
        </section>

        <!-- Stat cards -->
        <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <p class="text-sm font-medium text-gray-500">{$t.home.activeProjects}</p>
                        <div class="mt-3 flex items-end gap-3">
                            <p class="text-4xl font-bold text-gray-900">{getOpenCount(assignments)}</p>
                            <span class="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">{$t.home.openItems}</span>
                        </div>
                    </div>
                    <div class="rounded-full bg-blue-100 p-3">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                </div>
            </article>

            <article class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <p class="text-sm font-medium text-gray-500">{$t.home.overdueItems}</p>
                        <div class="mt-3 flex items-end gap-3">
                            <p class="text-4xl font-bold text-red-700">{getOverdueCount(assignments)}</p>
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
                            <p class="text-4xl font-bold text-orange-700">{getDueSoonCount(assignments)}</p>
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
                <p class="mt-2 text-2xl font-semibold text-gray-900">{formatBudget(getAssignedBudget(assignments))}</p>
                <p class="mt-1 text-sm text-gray-500">{fmtH(getAssignedHours(assignments))}</p>
            </article>
        </section>

        <!-- Calendar + Workload -->
        <section class="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">

            <!-- Calendar -->
            <article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 class="text-xl font-semibold text-gray-900">{$t.taskPage.calendar}</h2>
                        <p class="mt-0.5 text-sm text-gray-500">{monthLabel}</p>
                    </div>
                    <div class="flex gap-2">
                        <button
                            onclick={prevMonth}
                            class="rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                        >‹</button>
                        <button
                            onclick={() => {
                                const now = new Date();
                                monthAnchor = new Date(now.getFullYear(), now.getMonth(), 1);
                            }}
                            class="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                        >{$t.taskPage.today}</button>
                        <button
                            onclick={nextMonth}
                            class="rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                        >›</button>
                    </div>
                </div>

                <div class="mb-1 grid grid-cols-7 gap-1">
                    {#each ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as wd}
                        <div class="px-1 pb-1 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">{wd}</div>
                    {/each}
                </div>

                <div class="grid grid-cols-7 gap-1">
                    {#each monthDays as day (day.toDateString())}
                        {@const dayAssigns = dayAssignments(day)}
                        {@const today = isToday(day)}
                        {@const isWeekend = day.getDay() === 0 || day.getDay() === 6}
                        {@const otherMonth = !isCurrentMonth(day)}
                        <div
                            class={`flex min-h-28 cursor-pointer flex-col rounded-2xl p-2 transition hover:border-blue-300 ${today ? "border border-blue-300 bg-blue-50" : isWeekend ? "bg-gray-50" : "border border-gray-100 bg-white"} ${otherMonth ? "opacity-45" : ""}`}
                            role="button"
                            tabindex="0"
                            onclick={() => openDayDrilldown(day)}
                            onkeydown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    openDayDrilldown(day);
                                }
                            }}
                        >
                            <div class="mb-1 text-center">
                                <p class={`text-xs font-semibold uppercase tracking-wide ${today ? "text-blue-600" : "text-gray-400"}`}>
                                    {day.toLocaleDateString(undefined, { weekday: "short" })}
                                </p>
                                <p class={`text-base font-bold ${today ? "text-blue-700" : "text-gray-700"}`}>
                                    {day.getDate()}
                                </p>
                            </div>
                            <div class="flex max-h-20 flex-col gap-0.5 overflow-y-auto">
                                {#each dayAssigns as a (a.id)}
                                    <button
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            openDayDrilldown(day, a.id);
                                        }}
                                        title={a.title}
                                        class={`w-full truncate rounded-lg border px-1.5 py-0.5 text-left text-xs font-medium transition hover:opacity-80 ${chipColor(a)} ${selectedId === a.id ? "ring-2 ring-blue-400" : ""}`}
                                    >{a.title}</button>
                                {/each}
                            </div>
                        </div>
                    {/each}
                </div>
            </article>

            <!-- Workload -->
            <article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <h2 class="text-xl font-semibold text-gray-900">{$t.home.workloadStatus}</h2>
                        <p class="mt-1 text-sm text-gray-500">{$t.home.currentAssignments}: {assignments.length}</p>
                    </div>
                    <p class="text-3xl font-bold text-purple-600">{calcCompletionRate(assignments).toFixed(0)}%</p>
                </div>

                <div class="mt-5 h-3 overflow-hidden rounded-full bg-gray-200">
                    <div class="flex h-full w-full overflow-hidden rounded-full">
                        <div class="bg-gray-400" style={`width: ${wWidth(statusCounts.Pending)}`}></div>
                        <div class="bg-blue-500" style={`width: ${wWidth(statusCounts["To Do"])}`}></div>
                        <div class="bg-orange-400" style={`width: ${wWidth(statusCounts["In Progress"])}`}></div>
                        <div class="bg-green-500" style={`width: ${wWidth(statusCounts.Done)}`}></div>
                    </div>
                </div>

                <div class="mt-5 grid grid-cols-2 gap-3">
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
        </section>

        <!-- Task list with inline work log + chat -->
        <section>
            <article class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <!-- Filter bar -->
                <div class="mb-5 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 class="text-xl font-semibold text-gray-900">{$t.home.nextAssignments}</h2>
                        <p class="mt-1 text-sm text-gray-500">{$t.home.focus}</p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <input
                            type="search"
                            placeholder={$t.projects.fullTextSearch}
                            bind:value={searchText}
                            class="w-44 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 transition focus:border-blue-300 focus:bg-white"
                        />
                        <select
                            bind:value={statusFilter}
                            class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 outline-none transition focus:border-blue-300 focus:bg-white"
                        >
                            <option value="">— {$t.common.status} —</option>
                            <option value="Pending">{$t.taskStatus.pending}</option>
                            <option value="To Do">{$t.taskStatus.toDo}</option>
                            <option value="In Progress">{$t.taskStatus.inProgress}</option>
                            <option value="Done">{$t.taskStatus.done}</option>
                        </select>
                    </div>
                </div>

                {#if filtered.length > 0}
                    <div class="max-h-160 space-y-2 overflow-y-auto pr-1">
                        {#each filtered as item (item.id)}
                            {@const isSelected = selectedId === item.id}
                            {@const hrs = entryHours(item.id)}
                            {@const mCnt = msgCount(item.id)}
                            {@const meta = getAssignmentMeta(item.id)}
                            <div class={`rounded-2xl border transition ${isSelected ? "border-blue-300 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}>

                                <!-- Clickable task header -->
                                <div
                                    class="w-full cursor-pointer text-left"
                                    role="button"
                                    tabindex="0"
                                    onclick={() => selectItem(item.id)}
                                    onkeydown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            selectItem(item.id);
                                        }
                                    }}
                                >
                                    <div class="flex items-center justify-between gap-4 p-4">
                                        <div class="min-w-0 flex-1">
                                            <div class="mb-1.5 flex flex-wrap items-center gap-1.5">
                                                <span class={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusCls(item.status)}`}>
                                                    {statusLabel(item.status)}
                                                </span>
                                                <span class="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                                                    {item.kind === "task" ? $t.home.itemTypeTask : $t.home.itemTypeSubtask}
                                                </span>
                                                {#if item.isOverdue}
                                                    <span class="shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">{$t.home.overdueItems}</span>
                                                {/if}
                                                {#if meta.isCritical}
                                                    <span class="shrink-0 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">Critical</span>
                                                {/if}
                                                <select
                                                    value={item.status}
                                                    onclick={(e) => e.stopPropagation()}
                                                    onchange={(e) => changeStatus(item.id, (e.currentTarget as HTMLSelectElement).value as WorkStatus)}
                                                    class="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-semibold text-gray-700"
                                                >
                                                    <option value="Pending">{$t.taskStatus.pending}</option>
                                                    <option value="To Do">{$t.taskStatus.toDo}</option>
                                                    <option value="In Progress">{$t.taskStatus.inProgress}</option>
                                                    <option value="Done">{$t.taskStatus.done}</option>
                                                </select>
                                                {#if hrs > 0}
                                                    <span class="shrink-0 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">{hrs.toFixed(1)}h {$t.taskPage.loggedShort}</span>
                                                {/if}
                                                {#if mCnt > 0}
                                                    <span class="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">{mCnt} {$t.taskPage.messagesShort}</span>
                                                {/if}
                                            </div>
                                            <p class="truncate text-sm font-semibold text-gray-900">{item.title}</p>
                                            <p class="text-xs text-gray-500">{item.projectTitle} · {fmtH(item.estimatedHours)} est.</p>
                                            {#if meta.riskNote}
                                                <p class="mt-1 line-clamp-2 text-xs text-rose-700">Risk: {meta.riskNote}</p>
                                            {/if}
                                        </div>
                                        <div class="flex shrink-0 items-center gap-3">
                                            <div class="hidden text-right sm:block">
                                                <p class="text-xs font-medium text-gray-700">{item.dueDate ? dueDateLabel(item.dueDate) : "—"}</p>
                                                <p class={`text-xs font-semibold ${item.isOverdue ? "text-red-600" : item.isDueSoon ? "text-orange-500" : "text-gray-400"}`}>
                                                    {timelineLabel(item)}
                                                </p>
                                            </div>
                                            <svg class={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${isSelected ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                <!-- Expandable detail panel -->
                                {#if isSelected}
                                    <div class="border-t border-gray-100 p-4">

                                        <!-- Tabs -->
                                        <div class="mb-4 flex gap-1">
                                            <button
                                                onclick={() => (detailTab = "worklog")}
                                                class={`rounded-xl px-4 py-2 text-sm font-semibold transition ${detailTab === "worklog" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                                            >
                                                {$t.taskPage.workLog}
                                                {#if selEntries.length > 0}
                                                    <span class="ml-1.5 rounded-full bg-white/30 px-1.5 text-xs">{selEntries.length}</span>
                                                {/if}
                                            </button>
                                            <button
                                                onclick={() => (detailTab = "chat")}
                                                class={`rounded-xl px-4 py-2 text-sm font-semibold transition ${detailTab === "chat" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                                            >
                                                {$t.taskPage.chat}
                                                {#if selMsgs.length > 0}
                                                    <span class="ml-1.5 rounded-full bg-white/30 px-1.5 text-xs">{selMsgs.length}</span>
                                                {/if}
                                            </button>
                                        </div>

                                        <!-- Work Log tab -->
                                        {#if detailTab === "worklog"}
                                            {#if selEntries.length > 0}
                                                <div class="mb-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                                                    {#each selEntries as w (w.id)}
                                                        <div class="flex items-start justify-between gap-3 rounded-xl bg-gray-50 p-3">
                                                            <div class="min-w-0">
                                                                <div class="mb-1 flex flex-wrap items-center gap-2">
                                                                    <span class="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">{w.hours.toFixed(1)}h</span>
                                                                    <span class="text-xs text-gray-400">{w.date} · {w.author}</span>
                                                                </div>
                                                                <p class="text-sm text-gray-700">{w.description}</p>
                                                            </div>
                                                            <button onclick={() => removeEntry(w.id)} aria-label="Remove entry" class="shrink-0 text-gray-300 transition hover:text-red-500">
                                                                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    {/each}
                                                </div>
                                                <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                                    {$t.taskPage.totalLogged}: <span class="text-purple-700">{loggedTotal.toFixed(1)}h</span>
                                                    &nbsp;/&nbsp;{fmtH(item.estimatedHours)} est.
                                                </p>
                                            {:else}
                                                <p class="mb-4 text-sm text-gray-400">{$t.taskPage.noWorkEntries}</p>
                                            {/if}

                                            <!-- Add work entry form -->
                                            <div class="rounded-xl border border-gray-200 bg-white p-3">
                                                <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{$t.taskPage.addWorkEntry}</p>
                                                <div class="mb-2 flex flex-wrap gap-2">
                                                    <input
                                                        type="date"
                                                        bind:value={wDate}
                                                        min={minWorkDate || undefined}
                                                        max={maxWorkDate || undefined}
                                                        class="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-300 focus:bg-white"
                                                    />
                                                    <div class="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
                                                        <input
                                                            type="number"
                                                            min="0.25"
                                                            max="24"
                                                            step="0.25"
                                                            bind:value={wHours}
                                                            class="w-14 bg-transparent text-sm text-gray-700 outline-none"
                                                        />
                                                        <span class="text-xs text-gray-400">{$t.common.hours}</span>
                                                    </div>
                                                </div>
                                                <div class="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder={$t.taskPage.workDescription}
                                                        bind:value={wDesc}
                                                        onkeydown={(e) => { if (e.key === "Enter") addEntry(); }}
                                                        class="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-300 focus:bg-white"
                                                    />
                                                    <button
                                                        onclick={addEntry}
                                                        class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                                                    >{$t.common.add}</button>
                                                </div>
                                                {#if selectedRuntime?.start || selectedRuntime?.end}
                                                    <p class="mt-2 text-xs text-gray-400">
                                                        {$t.projects.startDate}: {selectedRuntime?.start ? dueDateLabel(selectedRuntime.start) : "-"}
                                                        · {$t.projects.dueDate}: {selectedRuntime?.end ? dueDateLabel(selectedRuntime.end) : "-"}
                                                    </p>
                                                {/if}
                                            </div>

                                        <!-- Chat tab -->
                                        {:else}
                                            {#if selMsgs.length > 0}
                                                <div class="mb-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                                                    {#each selMsgs as m (m.id)}
                                                        {@const isOwn = m.from === `${$currentUser.firstName} ${$currentUser.lastName}`}
                                                        <div class={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                                                            <div class={`max-w-xs rounded-2xl px-3 py-2 ${isOwn ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                                                                <p class={`mb-0.5 text-xs font-semibold ${isOwn ? "text-blue-200" : "text-gray-500"}`}>
                                                                    {isOwn ? `→ ${m.to}` : m.from}
                                                                </p>
                                                                <p class="text-sm">{m.text}</p>
                                                            </div>
                                                            <p class="mt-0.5 px-1 text-xs text-gray-400">{fmtAt(m.at)}</p>
                                                        </div>
                                                    {/each}
                                                </div>
                                            {:else}
                                                <p class="mb-4 text-sm text-gray-400">{$t.taskPage.noMessages}</p>
                                            {/if}

                                            <!-- Send message form -->
                                            <div class="rounded-xl border border-gray-200 bg-white p-3">
                                                <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{$t.taskPage.to}</p>
                                                <select
                                                    bind:value={msgTo}
                                                    class="mb-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-300 focus:bg-white"
                                                >
                                                    <option value="">— {$t.taskPage.to} —</option>
                                                    {#each colleagues as c}
                                                        <option value={c}>{c}</option>
                                                    {/each}
                                                </select>
                                                <div class="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder={$t.taskPage.messagePlaceholder}
                                                        bind:value={msgText}
                                                        onkeydown={(e) => { if (e.key === "Enter") sendMsg(); }}
                                                        class="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-300 focus:bg-white"
                                                    />
                                                    <button
                                                        onclick={sendMsg}
                                                        class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                                                    >{$t.taskPage.sendMessage}</button>
                                                </div>
                                            </div>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div class="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500">
                        {$t.home.noAssignments}
                    </div>
                {/if}
            </article>
        </section>

    </div>
</div>

{#if dayModalOpen && dayModalDate}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
            aria-label="Close day details"
            class="absolute inset-0 bg-black/35"
            onclick={closeDayDrilldown}
        ></button>

        <div class="relative max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
            <div class="flex items-start justify-between border-b border-gray-100 px-6 py-4">
                <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">{$t.taskPage.calendar}</p>
                    <h3 class="mt-1 text-xl font-bold text-gray-900">{fmtDateLong(dayModalDate)}</h3>
                    <p class="mt-1 text-sm text-gray-500">{dayModalItems.length} {$t.home.currentAssignments}</p>
                </div>
                <button class="rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50" onclick={closeDayDrilldown}>
                    {$t.common.close}
                </button>
            </div>

            <div class="max-h-[60vh] overflow-y-auto p-6">
                {#if dayModalItems.length > 0}
                    <div class="space-y-3">
                        {#each dayModalItems as item (item.id)}
                            {@const runtime = runtimeById.get(item.id)}
                            {@const dayMeta = getAssignmentMeta(item.id)}
                            <button
                                class="w-full rounded-2xl border border-gray-200 p-4 text-left transition hover:border-blue-300 hover:bg-gray-50"
                                onclick={() => {
                                    openAssignmentModal(item.id);
                                    closeDayDrilldown();
                                }}
                            >
                                <div class="mb-2 flex flex-wrap items-center gap-2">
                                    <span class={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusCls(item.status)}`}>{statusLabel(item.status)}</span>
                                    <span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                                        {item.kind === "task" ? $t.home.itemTypeTask : $t.home.itemTypeSubtask}
                                    </span>
                                    {#if item.isOverdue}
                                        <span class="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">{$t.home.overdueItems}</span>
                                    {/if}
                                    {#if dayMeta.isCritical}
                                        <span class="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">Critical</span>
                                    {/if}
                                </div>
                                <p class="text-sm font-semibold text-gray-900">{item.title}</p>
                                <p class="mt-0.5 text-xs text-gray-500">{item.projectTitle}</p>
                                {#if dayMeta.riskNote}
                                    <p class="mt-1 text-xs text-rose-700">Risk: {dayMeta.riskNote}</p>
                                {/if}
                                <div class="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                                    <span>{$t.projects.startDate}: {runtime?.start ? dueDateLabel(runtime.start) : "-"}</span>
                                    <span>{$t.projects.dueDate}: {runtime?.end ? dueDateLabel(runtime.end) : "-"}</span>
                                    <span>{$t.common.hours}: {fmtH(item.estimatedHours)}</span>
                                    <span>{$t.common.cost}: {formatBudget(item.cost)}</span>
                                </div>
                            </button>
                        {/each}
                    </div>
                {:else}
                    <div class="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                        {$t.home.noAssignments}
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}

{#if assignmentModalOpen && assignmentModalItem}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
            aria-label="Close task details"
            class="absolute inset-0 bg-black/40"
            onclick={closeAssignmentModal}
        ></button>

        <div class="relative max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">
            <div class="flex items-start justify-between border-b border-gray-100 px-6 py-4">
                <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">{$t.nav.tasks}</p>
                    <h3 class="mt-1 text-xl font-bold text-gray-900">{assignmentModalItem.title}</h3>
                    <p class="mt-1 text-sm text-gray-500">{assignmentModalItem.projectTitle}</p>
                </div>
                <button class="rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50" onclick={closeAssignmentModal}>
                    {$t.common.close}
                </button>
            </div>

            <div class="border-b border-gray-100 px-6 py-3">
                <div class="flex flex-wrap gap-2">
                    <button
                        onclick={() => (assignmentTab = "stats")}
                        class={`rounded-xl px-4 py-2 text-sm font-semibold transition ${assignmentTab === "stats" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    >Stats</button>
                    <button
                        onclick={() => (assignmentTab = "worklog")}
                        class={`rounded-xl px-4 py-2 text-sm font-semibold transition ${assignmentTab === "worklog" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    >{$t.taskPage.workLog}</button>
                    <button
                        onclick={() => (assignmentTab = "chat")}
                        class={`rounded-xl px-4 py-2 text-sm font-semibold transition ${assignmentTab === "chat" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    >{$t.taskPage.chat}</button>
                </div>
            </div>

            <div class="max-h-[62vh] overflow-y-auto p-6">
                {#if assignmentTab === "stats"}
                    {@const modalMeta = getAssignmentMeta(assignmentModalItem.id)}
                    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                            <p class="text-xs uppercase tracking-wide text-gray-400">{$t.common.status}</p>
                            <div class="mt-2 flex items-center gap-2">
                                <p class="text-sm font-semibold text-gray-800">{statusLabel(assignmentModalItem.status)}</p>
                                <select
                                    value={assignmentModalItem.status}
                                    onchange={(e) => changeStatus(assignmentModalItem.id, (e.currentTarget as HTMLSelectElement).value as WorkStatus)}
                                    class="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700"
                                >
                                    <option value="Pending">{$t.taskStatus.pending}</option>
                                    <option value="To Do">{$t.taskStatus.toDo}</option>
                                    <option value="In Progress">{$t.taskStatus.inProgress}</option>
                                    <option value="Done">{$t.taskStatus.done}</option>
                                </select>
                            </div>
                        </div>
                        <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                            <p class="text-xs uppercase tracking-wide text-gray-400">{$t.common.hours}</p>
                            <p class="mt-2 text-sm font-semibold text-gray-800">{fmtH(assignmentModalItem.estimatedHours)}</p>
                        </div>
                        <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                            <p class="text-xs uppercase tracking-wide text-gray-400">{$t.common.cost}</p>
                            <p class="mt-2 text-sm font-semibold text-gray-800">{formatBudget(assignmentModalItem.cost)}</p>
                        </div>
                        <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                            <p class="text-xs uppercase tracking-wide text-gray-400">{$t.taskPage.totalLogged}</p>
                            <p class="mt-2 text-sm font-semibold text-gray-800">{assignmentModalLoggedTotal.toFixed(1)}h</p>
                        </div>
                    </div>
                    <div class="mt-4 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
                        <p>{$t.projects.startDate}: {assignmentModalRuntime?.start ? dueDateLabel(assignmentModalRuntime.start) : "-"}</p>
                        <p class="mt-1">{$t.projects.dueDate}: {assignmentModalRuntime?.end ? dueDateLabel(assignmentModalRuntime.end) : "-"}</p>
                        <p class="mt-1">{timelineLabel(assignmentModalItem)}</p>
                    </div>
                    <div class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                        <div class="flex flex-wrap items-center justify-between gap-3">
                            <p class="text-sm font-semibold text-rose-800">Risk & Criticality</p>
                            {#if modalMeta.isCritical}
                                <span class="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">Critical</span>
                            {/if}
                        </div>
                        <label class="mt-3 flex items-center gap-2 text-sm text-rose-900">
                            <input type="checkbox" bind:checked={assignmentCriticalDraft} class="checkbox checkbox-sm border-rose-300" />
                            Mark as critical task
                        </label>
                        <div class="mt-3">
                            <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-700">Risk Note</p>
                            <textarea
                                bind:value={assignmentRiskDraft}
                                rows="3"
                                placeholder="Describe risk, impact, or mitigation"
                                class="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-rose-300"
                            ></textarea>
                        </div>
                        <div class="mt-3 flex justify-end">
                            <button
                                onclick={saveAssignmentMeta}
                                class="rounded-lg bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-rose-700"
                            >Save Risk Info</button>
                        </div>
                    </div>
                {:else if assignmentTab === "worklog"}
                    {#if assignmentModalEntries.length > 0}
                        <div class="mb-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                            {#each assignmentModalEntries as w (w.id)}
                                <div class="flex items-start justify-between gap-3 rounded-xl bg-gray-50 p-3">
                                    <div class="min-w-0">
                                        <div class="mb-1 flex flex-wrap items-center gap-2">
                                            <span class="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">{w.hours.toFixed(1)}h</span>
                                            <span class="text-xs text-gray-400">{w.date} · {w.author}</span>
                                        </div>
                                        <p class="text-sm text-gray-700">{w.description}</p>
                                    </div>
                                    <button onclick={() => removeEntry(w.id)} aria-label="Remove entry" class="shrink-0 text-gray-300 transition hover:text-red-500">
                                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <p class="mb-4 text-sm text-gray-400">{$t.taskPage.noWorkEntries}</p>
                    {/if}

                    <div class="rounded-xl border border-gray-200 bg-white p-3">
                        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{$t.taskPage.addWorkEntry}</p>
                        <div class="mb-2 flex flex-wrap gap-2">
                            <input
                                type="date"
                                bind:value={wDate}
                                min={modalMinWorkDate || undefined}
                                max={modalMaxWorkDate || undefined}
                                class="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-300 focus:bg-white"
                            />
                            <div class="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
                                <input
                                    type="number"
                                    min="0.25"
                                    max="24"
                                    step="0.25"
                                    bind:value={wHours}
                                    class="w-14 bg-transparent text-sm text-gray-700 outline-none"
                                />
                                <span class="text-xs text-gray-400">{$t.common.hours}</span>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <input
                                type="text"
                                placeholder={$t.taskPage.workDescription}
                                bind:value={wDesc}
                                onkeydown={(e) => { if (e.key === "Enter") addEntry(); }}
                                class="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-300 focus:bg-white"
                            />
                            <button
                                onclick={addEntry}
                                class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                            >{$t.common.add}</button>
                        </div>
                    </div>
                {:else}
                    {#if assignmentModalMsgs.length > 0}
                        <div class="mb-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                            {#each assignmentModalMsgs as m (m.id)}
                                {@const isOwn = m.from === userFullName}
                                <div class={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                                    <div class={`max-w-xs rounded-2xl px-3 py-2 ${isOwn ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                                        <p class={`mb-0.5 text-xs font-semibold ${isOwn ? "text-blue-200" : "text-gray-500"}`}>
                                            {isOwn ? `→ ${m.to}` : m.from}
                                        </p>
                                        <p class="text-sm">{m.text}</p>
                                    </div>
                                    <p class="mt-0.5 px-1 text-xs text-gray-400">{fmtAt(m.at)}</p>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <p class="mb-4 text-sm text-gray-400">{$t.taskPage.noMessages}</p>
                    {/if}

                    <div class="rounded-xl border border-gray-200 bg-white p-3">
                        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{$t.taskPage.to}</p>
                        <select
                            bind:value={msgTo}
                            class="mb-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 outline-none focus:border-blue-300 focus:bg-white"
                        >
                            <option value="">— {$t.taskPage.to} —</option>
                            {#each colleagues as c}
                                <option value={c}>{c}</option>
                            {/each}
                        </select>
                        <div class="flex gap-2">
                            <input
                                type="text"
                                placeholder={$t.taskPage.messagePlaceholder}
                                bind:value={msgText}
                                onkeydown={(e) => { if (e.key === "Enter") sendMsg(); }}
                                class="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-300 focus:bg-white"
                            />
                            <button
                                onclick={sendMsg}
                                class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                            >{$t.taskPage.sendMessage}</button>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}
