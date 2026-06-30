<script setup>
import { ref } from 'vue'
import { authStore } from '../store/auth'
import { useRouter } from 'vue-router'
import ConfirmModal from './ConfirmModal.vue'

const router = useRouter()
const showLogoutConfirm = ref(false)

const handleLogoutClick = () => {
  showLogoutConfirm.value = true
}

const executeLogout = async () => {
  showLogoutConfirm.value = false
  try {
    await authStore.logout()
    router.push('/login')
  } catch (err) {
    alert('Gagal logout: ' + err.message)
  }
}
</script>

<template>
  <nav class="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <div class="flex items-center space-x-3">
          <div class="w-9 h-9 bg-pastel-lavender-500 rounded-xl flex items-center justify-center shadow-md shadow-indigo-100">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span class="text-xl font-bold bg-gradient-to-r from-slate-900 to-indigo-600 bg-clip-text text-transparent tracking-wide">
            InvenTrack
          </span>
        </div>

        <!-- User Profile & Actions -->
        <div class="flex items-center space-x-6" v-if="authStore.state.user">
          <div class="hidden md:flex flex-col text-right">
            <span class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Operator</span>
            <span class="text-sm font-semibold text-slate-700">{{ authStore.state.user.email }}</span>
          </div>
          
          <button 
            @click="handleLogoutClick"
            class="flex items-center space-x-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ease-in-out cursor-pointer shadow-sm shadow-rose-100/50"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </div>
  </nav>

  <!-- Logout Confirmation Modal -->
  <ConfirmModal
    :show="showLogoutConfirm"
    title="Keluar dari Sistem"
    message="Apakah Anda yakin ingin keluar dari sistem InvenTrack?"
    type="warning"
    confirm-text="Ya, Keluar"
    cancel-text="Batal"
    @confirm="executeLogout"
    @cancel="showLogoutConfirm = false"
  />
</template>
