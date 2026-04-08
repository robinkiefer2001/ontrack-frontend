<script lang="ts">
  import type { Language } from "$lib/language";
  import { t, currentLanguage, setLanguage } from "$lib/language";

  function changeLanguage(lang: Language) {
    setLanguage(lang);
  }

</script>

<div class="min-h-screen bg-white py-8">
  <div class="max-w-6xl mx-auto px-6">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-4xl font-bold text-gray-900">{$t.settings.title}</h1>
    </div>

    <!-- Language Settings -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 class="text-2xl font-bold text-gray-900 mb-6">{$t.settings.languageSettings}</h2>
      
      <div class="form-control w-full max-w-md">
        <div class="label">
          <span class="label-text text-lg font-semibold">{$t.settings.selectLanguage}</span>
        </div>
        <div class="flex gap-4">
          <label class="label cursor-pointer gap-3 border-2 rounded-lg px-6 py-4 hover:bg-gray-50 transition-colors"
                 class:border-blue-600={$currentLanguage === "de"}
                 class:bg-blue-50={$currentLanguage === "de"}>
            <input 
              type="radio" 
              class="radio radio-primary" 
              checked={$currentLanguage === "de"}
              on:change={() => changeLanguage("de")}
            />
            <span class="label-text font-semibold text-lg">🇩🇪 Deutsch</span>
          </label>
          
          <label class="label cursor-pointer gap-3 border-2 rounded-lg px-6 py-4 hover:bg-gray-50 transition-colors"
                 class:border-blue-600={$currentLanguage === "en"}
                 class:bg-blue-50={$currentLanguage === "en"}>
            <input 
              type="radio" 
              class="radio radio-primary" 
              checked={$currentLanguage === "en"}
              on:change={() => changeLanguage("en")}
            />
            <span class="label-text font-semibold text-lg">🇬🇧 English</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</div>
