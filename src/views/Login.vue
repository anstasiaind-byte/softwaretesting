<script setup>
import { ref, reactive } from 'vue'
import { authStore } from '../store/auth'
import { useRouter } from 'vue-router'

const router = useRouter()

const isRegister = ref(false)
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)

const form = reactive({
  email: '',
  password: '',
  confirmPassword: ''
})

const errors = reactive({
  email: '',
  password: '',
  confirmPassword: ''
})

const toggleMode = () => {
  isRegister.value = !isRegister.value
  errorMsg.value = ''
  successMsg.value = ''
  form.email = ''
  form.password = ''
  form.confirmPassword = ''
  showPassword.value = false
  showConfirmPassword.value = false
  Object.keys(errors).forEach(key => errors[key] = '')
}

// Input Validation
const validate = () => {
  let isValid = true
  Object.keys(errors).forEach(key => errors[key] = '')

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!form.email) {
    errors.email = 'Alamat email wajib diisi.'
    isValid = false
  } else if (!emailRegex.test(form.email)) {
    errors.email = 'Format email tidak valid (Contoh: user@email.com).'
    isValid = false
  }

  if (!form.password) {
    errors.password = 'Kata sandi wajib diisi.'
    isValid = false
  } else if (form.password.length < 6) {
    errors.password = 'Kata sandi minimal 6 karakter.'
    isValid = false
  }

  if (isRegister.value) {
    if (!form.confirmPassword) {
      errors.confirmPassword = 'Konfirmasi kata sandi wajib diisi.'
      isValid = false
    } else if (form.password !== form.confirmPassword) {
      errors.confirmPassword = 'Kata sandi konfirmasi tidak cocok.'
      isValid = false
    }
  }

  return isValid
}

const handleSubmit = async () => {
  if (!validate()) return

  loading.value = true
  errorMsg.value = ''
  successMsg.value = ''

  try {
    if (isRegister.value) {
      const signUpData = await authStore.register(form.email, form.password)
      if (signUpData?.session) {
        successMsg.value = 'Registrasi berhasil! Mengalihkan ke dasbor...'
        setTimeout(() => {
          router.push('/dashboard')
        }, 1500)
      } else {
        successMsg.value = 'Registrasi berhasil! Silakan periksa email Anda untuk verifikasi akun.'
        form.email = ''
        form.password = ''
        form.confirmPassword = ''
        isRegister.value = false
      }
    } else {
      await authStore.login(form.email, form.password)
      router.push('/dashboard')
    }
  } catch (err) {
    if (err.message.includes('Invalid login')) {
      errorMsg.value = 'Email atau kata sandi salah.'
    } else if (err.message.includes('User already registered')) {
      errorMsg.value = 'Email sudah terdaftar.'
    } else {
      errorMsg.value = 'Gagal memproses: ' + err.message
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-[#f3f6fc] p-6 relative overflow-hidden">
    <!-- Decorative background pastel glow bubbles -->
    <div class="absolute w-[450px] h-[450px] bg-indigo-200/40 blur-[130px] rounded-full -top-24 -left-20"></div>
    <div class="absolute w-[400px] h-[400px] bg-pink-200/40 blur-[130px] rounded-full -bottom-20 -right-10"></div>
    <div class="absolute w-[300px] h-[300px] bg-emerald-200/30 blur-[100px] rounded-full top-2/3 left-10"></div>

    <!-- Login/Register Card -->
    <div class="relative w-full max-w-md bg-white border border-slate-100 rounded-[32px] p-8 shadow-xl shadow-indigo-100/50">
      
      <!-- Logo and Header -->
      <div class="flex flex-col items-center justify-center mb-8">
        <div class="w-12 h-12 bg-pastel-lavender-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200/50 mb-3">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-slate-800 tracking-tight">
          {{ isRegister ? 'Daftar Akun' : 'Masuk ke InvenTrack' }}
        </h2>
        <p class="text-xs text-slate-400 mt-1 font-medium">
          {{ isRegister ? 'Buat akun inventaris barang baru' : 'Silakan masuk ke dalam dasbor sistem' }}
        </p>
      </div>

      <!-- Error & Success Alert Blocks -->
      <div v-if="errorMsg" class="mb-4 text-xs text-rose-700 bg-rose-50 border border-rose-100 p-3.5 rounded-2xl font-medium">
        {{ errorMsg }}
      </div>
      <div v-if="successMsg" class="mb-4 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 p-3.5 rounded-2xl font-medium leading-relaxed">
        {{ successMsg }}
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Email Input -->
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Email</label>
          <div class="relative">
            <input 
              v-model="form.email"
              type="email" 
              placeholder="operator@email.com"
              class="w-full bg-slate-50/80 border border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200"
            />
            <span class="absolute left-3.5 top-3.5 text-slate-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
              </svg>
            </span>
          </div>
          <p v-if="errors.email" class="text-[11px] text-rose-500 mt-1 font-medium">{{ errors.email }}</p>
        </div>

        <!-- Password Input -->
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Kata Sandi</label>
          <div class="relative">
            <input 
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              class="w-full bg-slate-50/80 border border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-2xl pl-10 pr-10 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200"
            />
            <span class="absolute left-3.5 top-3.5 text-slate-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </span>
            <!-- Toggle password visibility button -->
            <button 
              type="button"
              @click="showPassword = !showPassword"
              class="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 transition-colors duration-200 cursor-pointer"
            >
              <svg v-if="showPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
          <p v-if="errors.password" class="text-[11px] text-rose-500 mt-1 font-medium">{{ errors.password }}</p>
        </div>

        <!-- Confirm Password (Register Mode only) -->
        <div v-if="isRegister">
          <label class="block text-xs font-bold text-slate-500 mb-1">Konfirmasi Kata Sandi</label>
          <div class="relative">
            <input 
              v-model="form.confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              placeholder="••••••••"
              class="w-full bg-slate-50/80 border border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-2xl pl-10 pr-10 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200"
            />
            <span class="absolute left-3.5 top-3.5 text-slate-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
            <!-- Toggle confirm password visibility button -->
            <button 
              type="button"
              @click="showConfirmPassword = !showConfirmPassword"
              class="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 transition-colors duration-200 cursor-pointer"
            >
              <svg v-if="showConfirmPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
          <p v-if="errors.confirmPassword" class="text-[11px] text-rose-500 mt-1 font-medium">{{ errors.confirmPassword }}</p>
        </div>

        <!-- Submit Button -->
        <button 
          type="submit" 
          :disabled="loading"
          class="w-full bg-pastel-lavender-500 hover:bg-pastel-lavender-600 disabled:bg-indigo-300 text-white font-semibold py-3 px-4 rounded-2xl text-sm transition-all duration-200 cursor-pointer flex items-center justify-center space-x-2 shadow-md shadow-indigo-100 mt-2"
        >
          <svg v-if="loading" class="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{{ loading ? 'Memproses...' : (isRegister ? 'Daftar' : 'Masuk') }}</span>
        </button>
      </form>

      <!-- Toggle Link -->
      <div class="mt-6 text-center border-t border-slate-100 pt-5">
        <button 
          @click="toggleMode" 
          class="text-xs text-slate-400 hover:text-indigo-500 font-semibold transition-colors duration-200 cursor-pointer"
        >
          {{ isRegister ? 'Sudah memiliki akun? Masuk' : 'Belum memiliki akun? Daftar Baru' }}
        </button>
      </div>

    </div>
  </div>
</template>
