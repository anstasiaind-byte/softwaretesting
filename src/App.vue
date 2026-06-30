<script setup>
import { onMounted } from 'vue'
import { authStore } from './store/auth'

onMounted(() => {
  authStore.checkSession()
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans">
    <!-- Loading Screen while checking initial session -->
    <div v-if="!authStore.state.initialized" class="flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <div class="relative w-16 h-16">
        <div class="absolute inset-0 rounded-full border-4 border-slate-200"></div>
        <div class="absolute inset-0 rounded-full border-4 border-t-indigo-400 animate-spin"></div>
      </div>
      <p class="mt-4 text-slate-500 font-medium tracking-wide animate-pulse">Menghubungkan ke Server...</p>
    </div>
    <router-view v-else />
  </div>
</template>
