<script setup>
defineProps({
  show: Boolean,
  title: {
    type: String,
    default: 'Konfirmasi Tindakan'
  },
  message: {
    type: String,
    default: 'Apakah Anda yakin ingin melakukan tindakan ini?'
  },
  type: {
    type: String,
    default: 'danger' // 'danger', 'warning', 'info'
  },
  confirmText: {
    type: String,
    default: 'Ya, Lanjutkan'
  },
  cancelText: {
    type: String,
    default: 'Batal'
  }
})

defineEmits(['confirm', 'cancel'])
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div 
      v-if="show" 
      class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs"
      @click.self="$emit('cancel')"
    >
      <Transition
        enter-active-class="transition duration-300 ease-out transform"
        enter-from-class="opacity-0 scale-95 translate-y-4"
        enter-to-class="opacity-100 scale-100 translate-y-0"
        leave-active-class="transition duration-200 ease-in transform"
        leave-from-class="opacity-100 scale-100 translate-y-0"
        leave-to-class="opacity-0 scale-95 translate-y-4"
      >
        <div class="bg-white border border-slate-100 rounded-[28px] max-w-sm w-full p-6 shadow-2xl relative overflow-hidden">
          
          <!-- Decorative Top Bar based on Type -->
          <div 
            class="h-1.5 absolute top-0 inset-x-0"
            :class="[
              type === 'danger' ? 'bg-gradient-to-r from-red-400 to-rose-500' :
              type === 'warning' ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
              'bg-gradient-to-r from-indigo-400 to-indigo-500'
            ]"
          ></div>

          <!-- Main Content -->
          <div class="flex flex-col items-center text-center mt-3">
            <!-- Icon Container -->
            <div 
              class="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
              :class="[
                type === 'danger' ? 'bg-rose-50 text-rose-500 border border-rose-100' :
                type === 'warning' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                'bg-indigo-50 text-indigo-500 border border-indigo-100'
              ]"
            >
              <!-- Icons -->
              <svg v-if="type === 'danger'" class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <svg v-else-if="type === 'warning'" class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <svg v-else class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <!-- Title & Message -->
            <h4 class="text-base font-bold text-slate-800 tracking-tight">{{ title }}</h4>
            <p class="text-xs text-slate-400 font-medium mt-2 leading-relaxed px-2">
              {{ message }}
            </p>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center space-x-3 mt-6">
            <button 
              type="button" 
              @click="$emit('cancel')"
              class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl text-xs transition-colors duration-200 cursor-pointer border border-slate-200 text-center"
            >
              {{ cancelText }}
            </button>
            <button 
              type="button" 
              @click="$emit('confirm')"
              class="flex-1 py-2.5 text-white font-semibold rounded-xl text-xs transition-all duration-200 cursor-pointer shadow-md text-center animate-pulse-slow"
              :class="[
                type === 'danger' ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-100' :
                type === 'warning' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100' :
                'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-100'
              ]"
            >
              {{ confirmText }}
            </button>
          </div>

        </div>
      </Transition>
    </div>
  </Transition>
</template>
