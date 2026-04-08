<script lang="ts">
  import onTrackCorpFav from "$lib/assets/onTrackCorpFav.png";
  import { goto } from "$app/navigation";
  import { t } from "$lib/language";
  import { login, isAuthenticated, authChecked } from "$lib/state/auth/auth.store";

  let username = $state("");
  let password = $state("");
  let error = $state("");
  let loading = $state(false);

  // If already logged in, redirect to home
  $effect(() => {
    if ($authChecked && $isAuthenticated) {
      goto("/");
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = "";
    loading = true;
    const result = await login(username.trim(), password);
    loading = false;
    if (result.success) {
      goto("/");
    } else {
      error = result.error ?? $t.login.invalidCredentials;
    }
  }
</script>

<svelte:head>
  <link rel="icon" href={onTrackCorpFav} />
  <title>OnTrack — {$t.login.signIn}</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
  <div class="w-full max-w-sm">
    <!-- Logo & Title -->
    <div class="mb-8 text-center">
      <div class="mb-4 flex justify-center">
        <img src={onTrackCorpFav} alt="OnTrack Logo" class="h-14 w-14" />
      </div>
      <h1 class="text-2xl font-bold text-gray-900">{$t.login.title}</h1>
      <p class="mt-1 text-sm text-gray-500">{$t.login.subtitle}</p>
    </div>

    <!-- Login Card -->
    <div class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <form onsubmit={handleSubmit} class="space-y-4">
        <!-- Username -->
        <div>
          <label for="username" class="mb-1 block text-sm font-medium text-gray-700">
            {$t.login.username}
          </label>
          <input
            id="username"
            type="text"
            autocomplete="username"
            required
            bind:value={username}
            placeholder={$t.login.usernamePlaceholder}
            class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <!-- Password -->
        <div>
          <label for="password" class="mb-1 block text-sm font-medium text-gray-700">
            {$t.login.password}
          </label>
          <input
            id="password"
            type="password"
            autocomplete="current-password"
            required
            bind:value={password}
            placeholder={$t.login.passwordPlaceholder}
            class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <!-- Error -->
        {#if error}
          <div class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        {/if}

        <!-- Submit -->
        <button
          type="submit"
          disabled={loading}
          class="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? $t.login.signingIn : $t.login.signIn}
        </button>
      </form>
    </div>
  </div>
</div>
