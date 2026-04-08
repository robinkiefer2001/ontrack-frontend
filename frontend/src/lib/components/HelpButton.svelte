<script lang="ts">
  import { t } from "$lib/language";

  let open = $state(false);
</script>

<!-- Floating help button -->
<button
  onclick={() => open = true}
  class="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl"
  aria-label={$t.help.title}
>
  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
</button>

<!-- Help panel overlay -->
{#if open}
  <!-- Backdrop -->
  <button
    class="fixed inset-0 z-50 bg-black/30"
    onclick={() => open = false}
    aria-label={$t.help.close}
  ></button>

  <!-- Slide-in panel -->
  <div class="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
      <h2 class="text-lg font-bold text-gray-900">{$t.help.userManual}</h2>
      <button
        onclick={() => open = false}
        class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
        aria-label={$t.help.close}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6">
      <div class="space-y-6">
        <!-- Getting Started -->
        <section>
          <h3 class="text-sm font-bold uppercase tracking-wide text-blue-600">{$t.help.gettingStarted}</h3>
          <p class="mt-1 text-sm leading-relaxed text-gray-600">{$t.help.gettingStartedDesc}</p>
        </section>

        <!-- Navigation -->
        <section>
          <h3 class="text-sm font-bold uppercase tracking-wide text-blue-600">{$t.help.navigation}</h3>
          <p class="mt-1 text-sm leading-relaxed text-gray-600">{$t.help.navigationDesc}</p>
        </section>

        <!-- Dashboard -->
        <section>
          <h3 class="text-sm font-bold uppercase tracking-wide text-blue-600">{$t.help.dashboard}</h3>
          <p class="mt-1 text-sm leading-relaxed text-gray-600">{$t.help.dashboardDesc}</p>
        </section>

        <!-- Projects -->
        <section>
          <h3 class="text-sm font-bold uppercase tracking-wide text-blue-600">{$t.help.projects}</h3>
          <p class="mt-1 text-sm leading-relaxed text-gray-600">{$t.help.projectsDesc}</p>
        </section>

        <!-- Tasks -->
        <section>
          <h3 class="text-sm font-bold uppercase tracking-wide text-blue-600">{$t.help.tasks}</h3>
          <p class="mt-1 text-sm leading-relaxed text-gray-600">{$t.help.tasksDesc}</p>
        </section>

        <!-- Employees -->
        <section>
          <h3 class="text-sm font-bold uppercase tracking-wide text-blue-600">{$t.help.employees}</h3>
          <p class="mt-1 text-sm leading-relaxed text-gray-600">{$t.help.employeesDesc}</p>
        </section>

        <!-- Customers -->
        <section>
          <h3 class="text-sm font-bold uppercase tracking-wide text-blue-600">{$t.help.customers}</h3>
          <p class="mt-1 text-sm leading-relaxed text-gray-600">{$t.help.customersDesc}</p>
        </section>

        <!-- Settings -->
        <section>
          <h3 class="text-sm font-bold uppercase tracking-wide text-blue-600">{$t.help.settings}</h3>
          <p class="mt-1 text-sm leading-relaxed text-gray-600">{$t.help.settingsDesc}</p>
        </section>

        <!-- Admin -->
        <section>
          <h3 class="text-sm font-bold uppercase tracking-wide text-blue-600">{$t.help.admin}</h3>
          <p class="mt-1 text-sm leading-relaxed text-gray-600">{$t.help.adminDesc}</p>
        </section>

        <!-- Profile -->
        <section>
          <h3 class="text-sm font-bold uppercase tracking-wide text-blue-600">{$t.help.profile}</h3>
          <p class="mt-1 text-sm leading-relaxed text-gray-600">{$t.help.profileDesc}</p>
        </section>

        <!-- Shortcuts -->
        <section>
          <h3 class="text-sm font-bold uppercase tracking-wide text-blue-600">{$t.help.shortcuts}</h3>
          <p class="mt-1 text-sm leading-relaxed text-gray-600">{$t.help.shortcutsDesc}</p>
        </section>

        <!-- Support -->
        <section>
          <h3 class="text-sm font-bold uppercase tracking-wide text-blue-600">{$t.help.support}</h3>
          <p class="mt-1 text-sm leading-relaxed text-gray-600">{$t.help.supportDesc}</p>
        </section>
      </div>
    </div>
  </div>
{/if}
