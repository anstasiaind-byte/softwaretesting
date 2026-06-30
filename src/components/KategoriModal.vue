<script setup>
import { ref, reactive, watch } from 'vue'
import { fetchKategori, createKategori, updateKategori, deleteKategori } from '../services/db'
import ConfirmModal from './ConfirmModal.vue'

const props = defineProps({
  show: Boolean
})

const emit = defineEmits(['close', 'refresh'])

const categories = ref([])
const loading = ref(false)
const submitting = ref(false)
const error = ref('')
const success = ref('')
const editingCatId = ref(null)

// Custom confirm modal states
const showConfirm = ref(false)
const confirmData = ref({ id: null, nama: '' })

const form = reactive({
  nama: '',
  deskripsi: ''
})

const loadCategories = async () => {
  loading.value = true
  error.value = ''
  try {
    categories.value = await fetchKategori()
  } catch (err) {
    error.value = 'Gagal memuat kategori: ' + err.message
  } finally {
    loading.value = false
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    loadCategories()
    resetForm()
  }
})

const resetForm = () => {
  form.nama = ''
  form.deskripsi = ''
  editingCatId.value = null
  error.value = ''
  success.value = ''
}

const startEdit = (cat) => {
  editingCatId.value = cat.id
  form.nama = cat.nama
  form.deskripsi = cat.deskripsi || ''
  error.value = ''
  success.value = ''
}

const handleSubmit = async () => {
  if (!form.nama.trim()) {
    error.value = 'Nama kategori wajib diisi.'
    return
  }

  submitting.value = true
  error.value = ''
  success.value = ''

  try {
    if (editingCatId.value) {
      await updateKategori(editingCatId.value, form.nama.trim(), form.deskripsi.trim())
      success.value = 'Kategori berhasil diperbarui!'
    } else {
      await createKategori(form.nama.trim(), form.deskripsi.trim())
      success.value = 'Kategori berhasil ditambahkan!'
    }
    resetForm()
    await loadCategories()
    emit('refresh')
  } catch (err) {
    error.value = err.message.includes('unique') || err.message.includes('duplicate') 
      ? 'Kategori dengan nama tersebut sudah ada.' 
      : 'Gagal menyimpan kategori: ' + err.message
  } finally {
    submitting.value = false
  }
}

const confirmDelete = (id, nama) => {
  confirmData.value = { id, nama }
  showConfirm.value = true
}

const executeDelete = async () => {
  showConfirm.value = false
  error.value = ''
  success.value = ''
  try {
    await deleteKategori(confirmData.value.id)
    success.value = `Kategori "${confirmData.value.nama}" berhasil dihapus.`
    await loadCategories()
    emit('refresh')
  } catch (err) {
    error.value = 'Gagal menghapus kategori: ' + err.message
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
    <div class="relative w-full max-w-2xl bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-2xl">
      
      <!-- Modal Header -->
      <div class="flex items-center justify-between px-6 py-5 border-b border-slate-100">
        <h3 class="text-lg font-bold text-slate-800 flex items-center space-x-2">
          <div class="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span>Kelola Kategori Barang</span>
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

      <!-- Modal Body -->
      <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
        
        <!-- Column 1: Add/Edit Category Form -->
        <div class="space-y-4">
          <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {{ editingCatId ? 'Ubah Kategori' : 'Tambah Kategori Baru' }}
          </h4>
          
          <form @submit.prevent="handleSubmit" class="space-y-3.5">
            <div>
              <label class="block text-xs font-bold text-slate-500 mb-1">Nama Kategori *</label>
              <input 
                v-model="form.nama"
                type="text" 
                placeholder="Contoh: Elektronik"
                class="w-full bg-slate-50/80 border border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200"
              />
            </div>
            
            <div>
              <label class="block text-xs font-bold text-slate-500 mb-1">Deskripsi Kategori</label>
              <textarea 
                v-model="form.deskripsi"
                placeholder="Deskripsi singkat..."
                rows="3"
                class="w-full bg-slate-50/80 border border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200 resize-none"
              ></textarea>
            </div>

            <!-- Messages -->
            <div v-if="error" class="text-xs text-rose-700 bg-rose-50 border border-rose-100 px-3 py-2 rounded-xl font-medium">
              {{ error }}
            </div>
            <div v-if="success" class="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl font-medium">
              {{ success }}
            </div>

            <div class="flex flex-col space-y-2">
              <button 
                type="submit"
                :disabled="submitting"
                class="w-full bg-pastel-lavender-500 hover:bg-pastel-lavender-600 disabled:bg-indigo-300 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all duration-200 cursor-pointer flex items-center justify-center space-x-2 shadow-md shadow-indigo-100/50"
              >
                <svg v-if="submitting" class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{{ submitting ? 'Menyimpan...' : (editingCatId ? 'Perbarui Kategori' : 'Simpan Kategori') }}</span>
              </button>
              <button 
                v-if="editingCatId"
                type="button"
                @click="resetForm"
                class="w-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-semibold py-2 px-4 rounded-xl text-xs transition-colors duration-200 cursor-pointer text-center"
              >
                Batal Edit
              </button>
            </div>
          </form>
        </div>

        <!-- Column 2: Categories List -->
        <div class="flex flex-col h-full min-h-[250px]">
          <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Daftar Kategori</h4>
          
          <div v-if="loading" class="flex flex-col items-center justify-center flex-grow py-8">
            <div class="w-8 h-8 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>

          <div v-else-if="categories.length === 0" class="flex flex-col items-center justify-center flex-grow py-8 border border-dashed border-slate-200 rounded-2xl">
            <span class="text-slate-400 text-sm font-medium">Belum ada kategori.</span>
          </div>

          <div v-else class="space-y-2 max-h-[350px] overflow-y-auto pr-1 flex-grow">
            <div 
              v-for="cat in categories" 
              :key="cat.id" 
              class="flex items-start justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-xl hover:border-slate-200 hover:bg-slate-50 transition-all duration-200"
            >
              <div class="pr-3">
                <h5 class="text-sm font-bold text-slate-700">{{ cat.nama }}</h5>
                <p class="text-xs text-slate-400 mt-0.5 leading-relaxed">{{ cat.deskripsi || 'Tidak ada deskripsi' }}</p>
              </div>
              <div class="flex items-center space-x-1 flex-shrink-0">
                <button 
                  @click="startEdit(cat)"
                  class="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all duration-200 cursor-pointer"
                  title="Edit Kategori"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button 
                  @click="confirmDelete(cat.id, cat.nama)"
                  class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all duration-200 cursor-pointer flex-shrink-0"
                  title="Hapus Kategori"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- Custom Confirmation Modal -->
  <ConfirmModal 
    :show="showConfirm"
    title="Hapus Kategori"
    :message="`Apakah Anda yakin ingin menghapus kategori '${confirmData.nama}'? Barang dengan kategori ini akan diset menjadi 'Tanpa Kategori'.`"
    type="danger"
    confirm-text="Ya, Hapus"
    cancel-text="Batal"
    @confirm="executeDelete"
    @cancel="showConfirm = false"
  />
</template>

