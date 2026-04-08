<script lang="ts">
    import { currentUser, getUserInitials } from "$lib/modules/user/store";
    import { t } from "$lib/language";

    // Editable fields (mock — will be synced to backend)
    let bio = $state("");
    let email = $state($currentUser.email);
    let phone = $state($currentUser.phone);
    let infoSaved = $state(false);

    // Password change (mock)
    let currentPassword = $state("");
    let newPassword = $state("");
    let confirmPassword = $state("");
    let pwError = $state("");
    let pwSuccess = $state(false);

    // MFA (mock)
    let mfaEnabled = $state(false);
    let showMfaSetup = $state(false);
    let mfaCode = $state("");
    let mfaSuccess = $state(false);
    let showMfaDisableConfirm = $state(false);

    function savePersonalInfo() {
        // Mock: in production this would call the backend
        infoSaved = true;
        setTimeout(() => (infoSaved = false), 3000);
    }

    function updatePassword() {
        pwError = "";
        pwSuccess = false;
        if (newPassword !== confirmPassword) {
            pwError = $t.profile.passwordMismatch;
            return;
        }
        // Mock: backend would validate current password & update
        pwSuccess = true;
        currentPassword = "";
        newPassword = "";
        confirmPassword = "";
        setTimeout(() => (pwSuccess = false), 3000);
    }

    function startMfaSetup() {
        showMfaSetup = true;
        mfaCode = "";
        mfaSuccess = false;
    }

    function confirmMfa() {
        if (mfaCode.length === 6) {
            mfaEnabled = true;
            showMfaSetup = false;
            mfaSuccess = true;
            mfaCode = "";
            setTimeout(() => (mfaSuccess = false), 3000);
        }
    }

    function disableMfa() {
        mfaEnabled = false;
        showMfaDisableConfirm = false;
    }

    // Mock metadata
    const memberSince = "2024-03-01";
    const lastLogin = "2026-03-18";
</script>

<div class="min-h-screen bg-gray-50 font-sans">
    <div class="mx-auto flex max-w-4xl flex-col gap-6 p-6">

        <!-- Header -->
        <section class="overflow-hidden rounded-4xl border border-gray-200 bg-white shadow-sm">
            <div class="p-6 lg:p-8">
                <div class="flex items-center gap-6">
                    <!-- Avatar (read-only) -->
                    <div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
                        {getUserInitials($currentUser.firstName, $currentUser.lastName)}
                    </div>
                    <div class="min-w-0">
                        <p class="text-sm uppercase tracking-[0.24em] text-blue-600">{$t.profile.title}</p>
                        <h1 class="mt-1 text-3xl font-bold tracking-tight text-gray-900">
                            {$currentUser.firstName} {$currentUser.lastName}
                        </h1>
                        <div class="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                            <span class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                                {$currentUser.jobTitle}
                            </span>
                            <span class="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                                {$currentUser.department}
                            </span>
                            <span class="text-xs text-gray-400">
                                {$t.profile.memberSince} {new Date(memberSince).toLocaleDateString("de-CH")}
                            </span>
                            <span class="text-xs text-gray-400">·</span>
                            <span class="text-xs text-gray-400">
                                {$t.profile.lastLogin} {new Date(lastLogin).toLocaleDateString("de-CH")}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Personal Information -->
        <section class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div class="mb-6">
                <h2 class="text-xl font-semibold text-gray-900">{$t.profile.personalInfo}</h2>
                <p class="mt-1 text-sm text-gray-500">{$t.profile.personalInfoDesc}</p>
            </div>

            <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
                <!-- First Name (read-only) -->
                <div class="flex flex-col gap-1.5">
                    <label for="profile-firstName" class="text-sm font-medium text-gray-700">{$t.profile.firstName}</label>
                    <input
                        id="profile-firstName"
                        type="text"
                        value={$currentUser.firstName}
                        disabled
                        class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                    />
                    <p class="text-xs text-gray-400">{$t.profile.readOnly}</p>
                </div>

                <!-- Last Name (read-only) -->
                <div class="flex flex-col gap-1.5">
                    <label for="profile-lastName" class="text-sm font-medium text-gray-700">{$t.profile.lastName}</label>
                    <input
                        id="profile-lastName"
                        type="text"
                        value={$currentUser.lastName}
                        disabled
                        class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                    />
                    <p class="text-xs text-gray-400">{$t.profile.readOnly}</p>
                </div>

                <!-- Email (editable) -->
                <div class="flex flex-col gap-1.5">
                    <label for="profile-email" class="text-sm font-medium text-gray-700">{$t.profile.email}</label>
                    <input
                        id="profile-email"
                        type="email"
                        bind:value={email}
                        class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200"
                    />
                </div>

                <!-- Phone (editable) -->
                <div class="flex flex-col gap-1.5">
                    <label for="profile-phone" class="text-sm font-medium text-gray-700">{$t.profile.phone}</label>
                    <input
                        id="profile-phone"
                        type="tel"
                        bind:value={phone}
                        class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200"
                    />
                </div>

                <!-- Job Title (read-only) -->
                <div class="flex flex-col gap-1.5">
                    <label for="profile-jobTitle" class="text-sm font-medium text-gray-700">{$t.profile.jobTitle}</label>
                    <input
                        id="profile-jobTitle"
                        type="text"
                        value={$currentUser.jobTitle}
                        disabled
                        class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                    />
                    <p class="text-xs text-gray-400">{$t.profile.readOnly}</p>
                </div>

                <!-- Department (read-only) -->
                <div class="flex flex-col gap-1.5">
                    <label for="profile-department" class="text-sm font-medium text-gray-700">{$t.profile.department}</label>
                    <input
                        id="profile-department"
                        type="text"
                        value={$currentUser.department}
                        disabled
                        class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                    />
                    <p class="text-xs text-gray-400">{$t.profile.readOnly}</p>
                </div>

                <!-- Bio (editable, full width) -->
                <div class="flex flex-col gap-1.5 md:col-span-2">
                    <label for="profile-bio" class="text-sm font-medium text-gray-700">{$t.profile.bio}</label>
                    <textarea
                        id="profile-bio"
                        bind:value={bio}
                        rows="3"
                        placeholder={$t.profile.bioPlaceholder}
                        class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200"
                    ></textarea>
                </div>
            </div>

            <div class="mt-6 flex items-center gap-3">
                <button
                    onclick={savePersonalInfo}
                    class="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                >{$t.profile.saveChanges}</button>
                {#if infoSaved}
                    <span class="text-sm font-medium text-green-600">{$t.profile.changesSaved}</span>
                {/if}
            </div>
        </section>

        <!-- Security -->
        <section class="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div class="mb-6">
                <h2 class="text-xl font-semibold text-gray-900">{$t.profile.security}</h2>
                <p class="mt-1 text-sm text-gray-500">{$t.profile.securityDesc}</p>
            </div>

            <!-- Change Password -->
            <div class="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <h3 class="text-base font-semibold text-gray-900">{$t.profile.changePassword}</h3>

                <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div class="flex flex-col gap-1.5">
                        <label for="profile-currentPassword" class="text-sm font-medium text-gray-700">{$t.profile.currentPassword}</label>
                        <input
                            id="profile-currentPassword"
                            type="password"
                            bind:value={currentPassword}
                            class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200"
                        />
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label for="profile-newPassword" class="text-sm font-medium text-gray-700">{$t.profile.newPassword}</label>
                        <input
                            id="profile-newPassword"
                            type="password"
                            bind:value={newPassword}
                            class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200"
                        />
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label for="profile-confirmPassword" class="text-sm font-medium text-gray-700">{$t.profile.confirmPassword}</label>
                        <input
                            id="profile-confirmPassword"
                            type="password"
                            bind:value={confirmPassword}
                            class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200"
                        />
                    </div>
                </div>

                <div class="mt-4 flex items-center gap-3">
                    <button
                        onclick={updatePassword}
                        disabled={!currentPassword || !newPassword || !confirmPassword}
                        class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-40"
                    >{$t.profile.updatePassword}</button>
                    {#if pwError}
                        <span class="text-sm font-medium text-red-600">{pwError}</span>
                    {/if}
                    {#if pwSuccess}
                        <span class="text-sm font-medium text-green-600">{$t.profile.passwordUpdated}</span>
                    {/if}
                </div>
            </div>

            <!-- MFA -->
            <div class="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <h3 class="text-base font-semibold text-gray-900">{$t.profile.mfa}</h3>
                        <p class="mt-1 text-sm text-gray-500">{$t.profile.mfaDesc}</p>
                    </div>
                    <span class="shrink-0 rounded-full px-3 py-1 text-xs font-semibold {mfaEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}">
                        {mfaEnabled ? $t.profile.mfaEnabled : $t.profile.mfaDisabled}
                    </span>
                </div>

                {#if !mfaEnabled && !showMfaSetup}
                    <button
                        onclick={startMfaSetup}
                        class="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                    >{$t.profile.enableMfa}</button>
                {/if}

                {#if showMfaSetup}
                    <div class="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-5">
                        <h4 class="text-sm font-semibold text-blue-900">{$t.profile.mfaSetupTitle}</h4>
                        <p class="mt-1 text-sm text-blue-700">{$t.profile.mfaSetupDesc}</p>

                        <!-- Mock QR code placeholder -->
                        <div class="mt-4 flex justify-center">
                            <div class="flex h-40 w-40 items-center justify-center rounded-xl border-2 border-dashed border-blue-300 bg-white">
                                <div class="text-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                    </svg>
                                    <p class="mt-1 text-xs text-blue-500">QR Code</p>
                                </div>
                            </div>
                        </div>

                        <div class="mt-4 flex flex-col gap-1.5">
                            <label for="profile-mfaCode" class="text-sm font-medium text-blue-900">{$t.profile.mfaVerifyCode}</label>
                            <div class="flex gap-3">
                                <input
                                    id="profile-mfaCode"
                                    type="text"
                                    bind:value={mfaCode}
                                    maxlength="6"
                                    placeholder={$t.profile.mfaCodePlaceholder}
                                    class="w-48 rounded-lg border border-blue-200 bg-white px-3 py-2 text-center text-lg font-mono tracking-[0.3em] text-gray-900 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                                />
                                <button
                                    onclick={confirmMfa}
                                    disabled={mfaCode.length !== 6}
                                    class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
                                >{$t.profile.mfaConfirm}</button>
                            </div>
                        </div>
                    </div>
                {/if}

                {#if mfaEnabled && !showMfaSetup}
                    {#if showMfaDisableConfirm}
                        <div class="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                            <p class="text-sm text-red-700">{$t.profile.mfaDisableConfirm}</p>
                            <div class="mt-3 flex gap-2">
                                <button
                                    onclick={disableMfa}
                                    class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                                >{$t.profile.disableMfa}</button>
                                <button
                                    onclick={() => (showMfaDisableConfirm = false)}
                                    class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                                >{$t.common.cancel}</button>
                            </div>
                        </div>
                    {:else}
                        <button
                            onclick={() => (showMfaDisableConfirm = true)}
                            class="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        >{$t.profile.disableMfa}</button>
                    {/if}
                {/if}

                {#if mfaSuccess}
                    <p class="mt-3 text-sm font-medium text-green-600">{$t.profile.mfaSuccess}</p>
                {/if}
            </div>
        </section>

    </div>
</div>
