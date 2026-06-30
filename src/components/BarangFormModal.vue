<script setup>
import { ref, reactive, watch } from 'vue'
import { fetchKategori, createBarang, updateBarang, uploadFotoBarang, deleteFotoBarang } from '../services/db'
import { supabase } from '../supabase'

const props = defineProps({
  show: Boolean,
  barangId: String
})

const emit = defineEmits(['close', 'saved'])

const categories = ref([])
const loading = ref(false)
const submitting = ref(false)
const generalError = ref('')

const form = reactive({
  kode_barang: '',
  nama_barang: '',
  deskripsi: '',
  stok: 0,
  harga: 0,
  kategori_id: '',
  foto_url: ''
})

const errors = reactive({
  kode_barang: '',
  nama_barang: '',
  stok: '',
  harga: '',
  foto: ''
})

// File state
const selectedFile = ref(null)
const previewUrl = ref('')
const oldFotoUrl = ref('')

const loadCategories = async () => {
  try {
    categories.value = await fetchKategori()
  } catch (err) {
    console.error('Gagal memuat kategori:', err)
  }
}

const loadBarangData = async () => {
  if (!props.barangId) return
  
  loading.value = true
  generalError.value = ''
  try {
    const { data, error } = await supabase
      .from('barang')
      .select('*')
      .eq('id', props.barangId)
      .single()

    if (error) throw error

    if (data) {
      form.kode_barang = data.kode_barang
      form.nama_barang = data.nama_barang
      form.deskripsi = data.deskripsi || ''
      form.stok = data.stok
      form.harga = data.harga
      form.kategori_id = data.kategori_id || ''
      form.foto_url = data.foto_url || ''
      previewUrl.value = data.foto_url || ''
      oldFotoUrl.value = data.foto_url || ''
    }
  } catch (err) {
    generalError.value = 'Gagal memuat data barang: ' + err.message
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.kode_barang = ''
  form.nama_barang = ''
  form.deskripsi = ''
  form.stok = 0
  form.harga = 0
  form.kategori_id = ''
  form.foto_url = ''
  selectedFile.value = null
  previewUrl.value = ''
  oldFotoUrl.value = ''
  
  Object.keys(errors).forEach(key => errors[key] = '')
  generalError.value = ''
}

watch(() => props.show, async (newVal) => {
  if (newVal) {
    resetForm()
    await loadCategories()
    if (props.barangId) {
      await loadBarangData()
    } else {
      generateNextSku()
    }
  }
})

const generateNextSku = async () => {
  try {
    const { data, error } = await supabase
      .from('barang')
      .select('kode_barang')
      .order('kode_barang', { ascending: false })
      .limit(1)

    if (error) throw error

    if (data && data.length > 0) {
      const lastCode = data[0].kode_barang
      const numPart = lastCode.split('-')[1]
      const nextNum = parseInt(numPart) + 1
      form.kode_barang = `BRG-${String(nextNum).padStart(5, '0')}`
    } else {
      form.kode_barang = 'BRG-00001'
    }
  } catch (err) {
    form.kode_barang = 'BRG-00001'
  }
}

const handleFileChange = (e) => {
  const file = e.target.files[0]
  errors.foto = ''
  if (!file) return

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    errors.foto = 'Format file harus berupa JPG, PNG, atau WEBP.'
    selectedFile.value = null
    return
  }

  const maxSize = 2 * 1024 * 1024 // 2MB
  if (file.size > maxSize) {
    errors.foto = 'Ukuran foto maksimal adalah 2MB.'
    selectedFile.value = null
    return
  }

  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
}

const validateForm = () => {
  let isValid = true
  Object.keys(errors).forEach(key => errors[key] = '')

  const skuRegex = /^BRG-\d{5}$/
  if (!form.kode_barang) {
    errors.kode_barang = 'Kode barang wajib diisi.'
    isValid = false
  } else if (!skuRegex.test(form.kode_barang)) {
    errors.kode_barang = 'Format kode barang harus "BRG-" diikuti 5 angka (Contoh: BRG-00021).'
    isValid = false
  }

  if (!form.nama_barang.trim()) {
    errors.nama_barang = 'Nama barang wajib diisi.'
    isValid = false
  } else if (form.nama_barang.trim().length < 3) {
    errors.nama_barang = 'Nama barang minimal 3 karakter.'
    isValid = false
  } else if (form.nama_barang.trim().length > 100) {
    errors.nama_barang = 'Nama barang maksimal 100 karakter.'
    isValid = false
  }

  if (form.stok === null || form.stok === undefined || form.stok === '') {
    errors.stok = 'Stok barang wajib diisi.'
    isValid = false
  } else {
    const stokNum = Number(form.stok)
    if (!Number.isInteger(stokNum) || stokNum < 0) {
      errors.stok = 'Stok harus berupa angka bulat positif atau 0.'
      isValid = false
    }
  }

  if (form.harga === null || form.harga === undefined || form.harga === '') {
    errors.harga = 'Harga barang wajib diisi.'
    isValid = false
  } else {
    const hargaNum = Number(form.harga)
    if (isNaN(hargaNum) || hargaNum < 0) {
      errors.harga = 'Harga harus berupa angka positif.'
      isValid = false
    }
  }

  return isValid
}

const handleSubmit = async () => {
  if (!validateForm()) return

  submitting.value = true
  generalError.value = ''

  try {
    let finalFotoUrl = form.foto_url

    if (selectedFile.value) {
      finalFotoUrl = await uploadFotoBarang(selectedFile.value)

      if (oldFotoUrl.value && oldFotoUrl.value.includes('barang-photos')) {
        try {
          await deleteFotoBarang(oldFotoUrl.value)
        } catch (delErr) {
          console.warn('Gagal menghapus foto lama:', delErr)
        }
      }
    }

    const payload = {
      kode_barang: form.kode_barang,
      nama_barang: form.nama_barang.trim(),
      deskripsi: form.deskripsi.trim(),
      stok: parseInt(form.stok),
      harga: parseFloat(form.harga),
      kategori_id: form.kategori_id ? parseInt(form.kategori_id) : null,
      foto_url: finalFotoUrl
    }

    if (props.barangId) {
      await updateBarang(props.barangId, payload)
    } else {
      await createBarang(payload)
    }

    emit('saved')
    closeModal()
  } catch (err) {
    if (err.message.includes('unique') || err.message.includes('duplicate')) {
      errors.kode_barang = 'Kode barang sudah terpakai oleh barang lain.'
    } else {
      generalError.value = 'Gagal menyimpan barang: ' + err.message
    }
  } finally {
    submitting.value = false
  }
}

const closeModal = () => {
  emit('close')
}
</script>

<template>
  <div 
    v-if="show"
    class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm transition-all duration-300"
  >
    <!-- Modal Card -->
    <div class="relative w-full max-w-lg bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-2xl">
      
      <!-- Modal Header -->
      <div class="flex items-center justify-between px-6 py-5 border-b border-slate-100">
        <h3 class="text-lg font-bold text-slate-800 flex items-center space-x-2">
          <div class="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span>{{ barangId ? 'Edit Data Barang' : 'Tambah Barang Baru' }}</span>
        </h3>
        <button 
          @click="closeModal" 
          class="text-slate-400 hover:text-slate-600 transition-colors duration-200 cursor-pointer"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-16 bg-white">
        <div class="w-10 h-10 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
        <p class="text-slate-400 font-medium text-sm mt-3">Memuat Data...</p>
      </div>

      <!-- Form Body -->
      <form v-else @submit.prevent="handleSubmit" class="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
        
        <!-- General error -->
        <div v-if="generalError" class="text-sm text-rose-700 bg-rose-50 border border-rose-100 p-3.5 rounded-2xl font-medium">
          {{ generalError }}
        </div>

        <!-- Row 1: SKU & Category -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Kode SKU Barang *</label>
            <input 
              v-model="form.kode_barang"
              type="text" 
              placeholder="BRG-00001"
              class="w-full bg-slate-50/80 border border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200"
              :disabled="barangId"
            />
            <p v-if="errors.kode_barang" class="text-[11px] text-rose-500 mt-1 font-medium">{{ errors.kode_barang }}</p>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Kategori Barang</label>
            <select 
              v-model="form.kategori_id"
              class="w-full bg-slate-50/80 border border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 cursor-pointer"
            >
              <option value="">Tanpa Kategori</option>
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.nama }}</option>
            </select>
          </div>
        </div>

        <!-- Name Input -->
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Nama Barang *</label>
          <input 
            v-model="form.nama_barang"
            type="text" 
            placeholder="Contoh: Laptop Asus VivoBook"
            class="w-full bg-slate-50/80 border border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200"
          />
          <p v-if="errors.nama_barang" class="text-[11px] text-rose-500 mt-1 font-medium">{{ errors.nama_barang }}</p>
        </div>

        <!-- Description Input -->
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Deskripsi Barang</label>
          <textarea 
            v-model="form.deskripsi"
            placeholder="Spesifikasi atau deskripsi tambahan..."
            rows="3"
            class="w-full bg-slate-50/80 border border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 resize-none"
          ></textarea>
        </div>

        <!-- Row 2: Stock & Price -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Stok Barang *</label>
            <input 
              v-model.number="form.stok"
              type="number" 
              min="0"
              placeholder="0"
              class="w-full bg-slate-50/80 border border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200"
            />
            <p v-if="errors.stok" class="text-[11px] text-rose-500 mt-1 font-medium">{{ errors.stok }}</p>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Harga Satuan (Rp) *</label>
            <input 
              v-model.number="form.harga"
              type="number" 
              min="0"
              placeholder="0"
              class="w-full bg-slate-50/80 border border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200"
            />
            <p v-if="errors.harga" class="text-[11px] text-rose-500 mt-1 font-medium">{{ errors.harga }}</p>
          </div>
        </div>

        <!-- Photo Upload Box -->
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Foto Barang</label>
          
          <div class="mt-1.5 flex flex-col sm:flex-row items-center gap-4">
            <!-- Preview Box -->
            <div class="w-24 h-24 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center flex-shrink-0 relative">
              <img 
                v-if="previewUrl" 
                :src="previewUrl" 
                class="w-full h-full object-cover" 
                alt="Foto Barang"
              />
              <svg 
                v-else 
                class="w-7 h-7 text-slate-300" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>

            <!-- Upload Area -->
            <div class="w-full">
              <label class="flex flex-col items-center justify-center w-full h-24 border border-dashed border-slate-200 hover:border-slate-350 rounded-2xl cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-all duration-200">
                <div class="flex flex-col items-center justify-center pt-4 pb-4">
                  <svg class="w-5 h-5 text-slate-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p class="text-xs text-slate-500 font-medium"><span class="font-semibold text-indigo-500">Klik untuk mengunggah</span></p>
                  <p class="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WEBP (Maks 2MB)</p>
                </div>
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/webp" 
                  class="hidden" 
                  @change="handleFileChange"
                />
              </label>
            </div>
          </div>
          <p v-if="errors.foto" class="text-[11px] text-rose-500 mt-1 font-medium">{{ errors.foto }}</p>
        </div>

        <!-- Modal Footer Actions -->
        <div class="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 mt-2">
          <button 
            type="button" 
            @click="closeModal" 
            class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl text-xs transition-colors duration-200 cursor-pointer border border-slate-200"
          >
            Batal
          </button>
          
          <button 
            type="submit"
            :disabled="submitting"
            class="bg-pastel-lavender-500 hover:bg-pastel-lavender-600 disabled:bg-indigo-300 text-white font-semibold py-2.5 px-6 rounded-xl text-xs transition-all duration-200 cursor-pointer flex items-center space-x-2 shadow-md shadow-indigo-100/50"
          >
            <svg v-if="submitting" class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ submitting ? 'Menyimpan...' : 'Simpan Barang' }}</span>
          </button>
        </div>

      </form>
    </div>
  </div>
</template>
