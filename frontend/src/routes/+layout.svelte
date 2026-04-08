<script lang="ts">
  import onTrackCorpFav from "$lib/assets/onTrackCorpFav.png";
  import "../app.css";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { t } from "$lib/language";
  import { currentUser, getUserInitials } from "$lib/modules/user/store";
  import { projectList } from "$lib/modules/projects/store";
  import { taskNotifications } from "$lib/state/notifications/taskNotifications.store";
  import { ensureRbac, currentPermissions } from "$lib/state/rbac/rbac.store";
  import { isAuthenticated, authChecked, checkSession, logout } from "$lib/state/auth/auth.store";
  import HelpButton from "$lib/components/HelpButton.svelte";

  let { children } = $props();
  let navSearch = $state("");

  let isLoginPage = $derived($page.url.pathname === "/login");

  let isAdmin = $derived($currentPermissions.has("admin.access"));

  // Check auth session on first render
  $effect(() => { checkSession(); });

  // Redirect to login if not authenticated (except on login page)
  $effect(() => {
    if ($authChecked && !$isAuthenticated && !isLoginPage) {
      goto("/login");
    }
  });

  // Load RBAC data once authenticated
  $effect(() => {
    if ($isAuthenticated) { ensureRbac(); }
  });

  let userFullName = $derived(`${$currentUser.firstName} ${$currentUser.lastName}`);

  let unreadMessages = $derived(
    $taskNotifications.filter((m) => m.to === userFullName && !m.read),
  );

  let warningItems = $derived.by(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const soon = new Date(today);
    soon.setDate(soon.getDate() + 2);

    const items: Array<{ id: string; title: string; type: "overdue" | "dueSoon"; projectTitle: string }> = [];

    for (const project of $projectList) {

      for (const task of project.Tasks || []) {
        const addTask = task.assignedTo === userFullName;
        if (addTask && task.status !== "Done" && task.dueDate) {
          const due = new Date(task.dueDate);
          due.setHours(0, 0, 0, 0);
          if (due < today) items.push({ id: `task-${project.projectID}-${task.taskID}`, title: task.title, type: "overdue", projectTitle: project.title });
          else if (due <= soon) items.push({ id: `task-${project.projectID}-${task.taskID}`, title: task.title, type: "dueSoon", projectTitle: project.title });
        }

        for (const sub of task.subtasks || []) {
          const addSub = sub.assignedTo === userFullName;
          if (!addSub || sub.status === "Done" || !sub.dueDate) continue;
          const due = new Date(sub.dueDate);
          due.setHours(0, 0, 0, 0);
          const title = `${task.title} / ${sub.title}`;
          if (due < today) items.push({ id: `subtask-${project.projectID}-${task.taskID}-${sub.subtaskID}`, title, type: "overdue", projectTitle: project.title });
          else if (due <= soon) items.push({ id: `subtask-${project.projectID}-${task.taskID}-${sub.subtaskID}`, title, type: "dueSoon", projectTitle: project.title });
        }
      }
    }

    return items.slice(0, 20);
  });

  let notificationCount = $derived(unreadMessages.length + warningItems.length);

  function runGlobalSearch() {
    const query = navSearch.trim();
    goto(query ? `/projects?q=${encodeURIComponent(query)}` : "/projects");
  }

  function openNotifications() {
    taskNotifications.markAllAsReadForUser(userFullName);
    goto("/tasks");
  }

  async function handleLogout() {
    await logout();
    goto("/login");
  }
</script>

<svelte:head>
  <link rel="icon" href={onTrackCorpFav} />
</svelte:head>

{#if isLoginPage}
  <!-- Login page gets no nav -->
  <main>
    {@render children()}
  </main>
{:else if $authChecked && $isAuthenticated}
<nav class="sticky top-0 z-40 w-full border-b border-gray-200 bg-white">
  <div class="mx-auto flex h-16 items-center gap-6 px-6">

    <!-- Logo -->
    <a href="/" class="flex shrink-0 items-center gap-2.5 text-base font-semibold text-gray-900">
      <img src={onTrackCorpFav} alt="OnTrack Logo" class="h-7 w-7" />
      OnTrack
    </a>

    <!-- Nav links -->
    <div class="flex gap-1 text-sm font-medium text-gray-600">
      <a href="/" class="rounded-lg px-3 py-2 transition hover:bg-gray-100 hover:text-gray-900">{$t.nav.home}</a>
      <a href="/projects" class="rounded-lg px-3 py-2 transition hover:bg-gray-100 hover:text-gray-900">{$t.nav.projects}</a>
      <a href="/customers" class="rounded-lg px-3 py-2 transition hover:bg-gray-100 hover:text-gray-900">{$t.nav.customers}</a>
      <a href="/employees" class="rounded-lg px-3 py-2 transition hover:bg-gray-100 hover:text-gray-900">{$t.nav.employees}</a>
      <a href="/tasks" class="rounded-lg px-3 py-2 transition hover:bg-gray-100 hover:text-gray-900">{$t.nav.tasks}</a>
      <a href="/reports" class="rounded-lg px-3 py-2 transition hover:bg-gray-100 hover:text-gray-900">{$t.nav.reports}</a>
      {#if isAdmin}
        <a href="/admin" class="rounded-lg px-3 py-2 transition hover:bg-gray-100 hover:text-gray-900">{$t.nav.admin}</a>
      {/if}
    </div>

    <!-- Right side -->
    <div class="ml-auto flex items-center gap-3">

      <!-- Search -->
      <input
        type="text"
        placeholder={$t.common.search}
        class="w-36 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 transition focus:w-52 focus:border-blue-300 focus:bg-white"
        bind:value={navSearch}
        onkeydown={(e) => { if (e.key === "Enter") runGlobalSearch(); }}
      />

      <!-- Notifications -->
      <div class="dropdown dropdown-end dropdown-bottom">
        <button
          tabindex="0"
          class="relative flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50"
          aria-label={$t.projects.notifications}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {#if notificationCount > 0}
            <span class="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[10px] font-bold leading-5 text-white">
              {notificationCount > 99 ? "99+" : notificationCount}
            </span>
          {/if}
        </button>

        <div class="dropdown-content z-50 mt-2 w-96 rounded-2xl border border-gray-200 bg-white p-2 shadow-lg">
          <div class="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <p class="text-sm font-semibold text-gray-900">{$t.projects.notifications}</p>
            <button class="rounded-lg px-2 py-1 text-xs text-blue-700 transition hover:bg-blue-50" onclick={openNotifications}>
              {$t.nav.tasks}
            </button>
          </div>

          <div class="max-h-80 overflow-y-auto p-1">
            {#if unreadMessages.length === 0 && warningItems.length === 0}
              <p class="px-2 py-3 text-sm text-gray-500">0 {$t.projects.notifications}</p>
            {/if}

            {#if unreadMessages.length > 0}
              <p class="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Messages</p>
              {#each unreadMessages as msg (msg.id)}
                <a href="/tasks" class="mt-1 block rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 transition hover:bg-blue-100" onclick={() => taskNotifications.markAllAsReadForUser(userFullName)}>
                  <p class="text-xs font-semibold text-blue-700">{msg.from} → {msg.assignmentTitle}</p>
                  <p class="mt-0.5 line-clamp-2 text-sm text-blue-900">{msg.text}</p>
                </a>
              {/each}
            {/if}

            {#if warningItems.length > 0}
              <p class="px-2 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Warnings</p>
              {#each warningItems as item (item.id)}
                <a href="/tasks" class={`mt-1 block rounded-xl px-3 py-2 transition ${item.type === "overdue" ? "border border-red-100 bg-red-50 hover:bg-red-100" : "border border-orange-100 bg-orange-50 hover:bg-orange-100"}`}>
                  <p class={`text-xs font-semibold ${item.type === "overdue" ? "text-red-700" : "text-orange-700"}`}>
                    {item.type === "overdue" ? $t.home.overdueItems : $t.home.dueThisWeek}
                  </p>
                  <p class="mt-0.5 text-sm text-gray-900">{item.title}</p>
                  <p class="text-xs text-gray-500">{item.projectTitle}</p>
                </a>
              {/each}
            {/if}
          </div>
        </div>
      </div>

      <!-- User dropdown -->
      <div class="dropdown dropdown-end dropdown-bottom">
        <div
          tabindex="0"
          role="button"
          class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 transition hover:bg-blue-200"
        >
          {getUserInitials($currentUser.firstName, $currentUser.lastName)}
        </div>
        <div class="dropdown-content z-50 mt-2 w-80 rounded-2xl border border-gray-200 bg-white p-2 shadow-lg">
          <div class="border-b border-gray-100 px-3 py-2">
            <p class="text-sm font-semibold text-gray-900">{$currentUser.firstName} {$currentUser.lastName}</p>
            <p class="text-xs text-gray-600">{$currentUser.jobTitle}</p>
            <p class="text-xs text-gray-500">{$currentUser.email}</p>
          </div>
          <div class="mt-2 grid grid-cols-2 gap-1 border-t border-gray-100 px-1 pt-2">
            <a href="/myprofile" class="rounded-xl px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-100">{$t.nav.myProfile}</a>
            <a href="/settings" class="rounded-xl px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-100">{$t.nav.settings}</a>
          </div>
          <div class="border-t border-gray-100 px-1 pt-2 mt-1">
            <button
              onclick={handleLogout}
              class="w-full rounded-xl px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
            >
              {$t.login.logout}
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</nav>

<main>
  {@render children()}
</main>
<HelpButton />
{/if}
