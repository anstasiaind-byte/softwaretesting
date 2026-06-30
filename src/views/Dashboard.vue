<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { supabase } from '../supabase'
import { fetchBarang, deleteBarang, deleteFotoBarang, fetchKategori, fetchAktivitas, updateBarang } from '../services/db'
import Navbar from '../components/Navbar.vue'
import BarangFormModal from '../components/BarangFormModal.vue'
import KategoriModal from '../components/KategoriModal.vue'
import AnalyticsCharts from '../components/AnalyticsCharts.vue'
import ConfirmModal from '../components/ConfirmModal.vue'

// Tab state (fitur pembeda)
const activeTab = ref('barang') // 'barang' or 'aktivitas'

// State
const items = ref([])
const categories = ref([])
const activityLogs = ref([])
const totalItems = ref(0)
const totalPages = ref(0)
const currentPage = ref(1)
const itemsPerPage = ref(10)
const loading = ref(false)
const logsLoading = ref(false)
const searchQuery = ref('')
const selectedKategori = ref('')
const sortBy = ref('created_at')
const sortOrder = ref('desc')

// Modal States
const showFormModal = ref(false)
const showKategoriModal = ref(false)
const activeBarangId = ref(null)
const adjustingStockId = ref(null)

// Refresh key to force chart updates
const refreshKey = ref(0)

// Custom Delete Confirm Modal States
const showDeleteConfirm = ref(false)
const deleteConfirmData = ref({ id: null, nama: '', fotoUrl: '' })

// Summary metrics
const metrics = reactive({
  totalItems: 0,
  totalStock: 0,
  outOfStock: 0,
  lowStock: 0
})

// Debounce timer
let debounceTimer = null

// Load paginated list of items
const loadItems = async () => {
  loading.value = true
  try {
    const result = await fetchBarang({
      page: currentPage.value,
      limit: itemsPerPage.value,
      search: searchQuery.value,
      kategoriId: selectedKategori.value ? parseInt(selectedKategori.value) : null,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value
    })
    
    items.value = result.items
    totalItems.value = result.totalItems
    totalPages.value = result.totalPages
  } catch (err) {
    alert('Gagal mengambil data barang: ' + err.message)
  } finally {
    loading.value = false
  }
}

// Load activity logs
const loadLogs = async () => {
  logsLoading.value = true
  try {
    activityLogs.value = await fetchAktivitas()
  } catch (err) {
    console.error('Gagal memuat log aktivitas:', err)
  } finally {
    logsLoading.value = false
  }
}

// Load metric cards data
const loadMetrics = async () => {
  try {
    const { data, error } = await supabase
      .from('barang')
      .select('stok, harga')

    if (error) throw error

    if (data) {
      metrics.totalItems = data.length
      metrics.totalStock = data.reduce((acc, curr) => acc + (curr.stok || 0), 0)
      metrics.outOfStock = data.filter(item => (item.stok || 0) === 0).length
      metrics.lowStock = data.filter(item => (item.stok || 0) > 0 && (item.stok || 0) < 10).length
    }
  } catch (err) {
    console.error('Gagal mengambil metrik:', err)
  }
}

// Load dropdown categories list
const loadCategories = async () => {
  try {
    categories.value = await fetchKategori()
  } catch (err) {
    console.error('Gagal mengambil kategori dropdown:', err)
  }
}

// Event handlers
const handleAdd = () => {
  activeBarangId.value = null
  showFormModal.value = true
}

const handleEdit = (id) => {
  activeBarangId.value = id
  showFormModal.value = true
}

// Replacement for native delete confirm
const handleDeleteClick = (id, nama, fotoUrl) => {
  deleteConfirmData.value = { id, nama, fotoUrl }
  showDeleteConfirm.value = true
}

const executeDeleteBarang = async () => {
  showDeleteConfirm.value = false
  const { id, nama, fotoUrl } = deleteConfirmData.value

  try {
    await deleteBarang(id)

    if (fotoUrl && fotoUrl.includes('barang-photos')) {
      try {
        await deleteFotoBarang(fotoUrl)
      } catch (delErr) {
        console.warn('Gagal menghapus file foto dari storage:', delErr)
      }
    }

    await loadItems()
    await loadMetrics()
    refreshKey.value++ // trigger chart update
    if (activeTab.value === 'aktivitas') {
      await loadLogs()
    }
  } catch (err) {
    alert('Gagal menghapus barang: ' + err.message)
  }
}

// Quick adjust stock inline
const quickAdjustStock = async (item, change) => {
  if (adjustingStockId.value) return
  
  const newStock = item.stok + change
  if (newStock < 0) return

  adjustingStockId.value = item.id
  try {
    const payload = {
      kode_barang: item.kode_barang,
      nama_barang: item.nama_barang,
      deskripsi: item.deskripsi || '',
      stok: newStock,
      harga: item.harga,
      kategori_id: item.kategori_id,
      foto_url: item.foto_url || ''
    }
    
    await updateBarang(item.id, payload)
    item.stok = newStock
    
    // Refresh metrics & charts in background
    await loadMetrics()
    refreshKey.value++
    if (activeTab.value === 'aktivitas') {
      await loadLogs()
    }
  } catch (err) {
    alert('Gagal menyesuaikan stok: ' + err.message)
  } finally {
    adjustingStockId.value = null
  }
}

// Export to CSV Function
const exporting = ref(false)
const exportToCSV = async () => {
  exporting.value = true
  try {
    const { data, error } = await supabase
      .from('barang')
      .select('kode_barang, nama_barang, deskripsi, stok, harga, kategori(nama), created_at')
      .order('kode_barang', { ascending: true })

    if (error) throw error

    if (!data || data.length === 0) {
      alert('Tidak ada data barang untuk diekspor.')
      return
    }

    // Helper to escape CSV text values
    const escapeCsvValue = (val) => {
      if (val === null || val === undefined) return ''
      let str = String(val)
      str = str.replace(/"/g, '""') // escape double quotes
      if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes(';')) {
        str = `"${str}"`
      }
      return str
    }

    // Headers
    const headers = ['Kode SKU', 'Nama Barang', 'Deskripsi', 'Kategori', 'Stok', 'Harga Satuan (Rp)', 'Tanggal Input']
    
    // Rows
    const rows = data.map(item => [
      escapeCsvValue(item.kode_barang),
      escapeCsvValue(item.nama_barang),
      escapeCsvValue(item.deskripsi),
      escapeCsvValue(item.kategori?.nama || 'Tanpa Kategori'),
      escapeCsvValue(item.stok),
      escapeCsvValue(item.harga),
      escapeCsvValue(new Date(item.created_at).toLocaleDateString('id-ID'))
    ])

    // Join with CSV formatting
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    // Create file blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `inventaris_barang_${new Date().toISOString().slice(0,10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    alert('Gagal mengekspor data: ' + err.message)
  } finally {
    exporting.value = false
  }
}

// Pagination helpers
const changePage = (page) => {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  loadItems()
}

// Watch filters
watch(searchQuery, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    currentPage.value = 1
    loadItems()
  }, 300)
})

watch(selectedKategori, () => {
  currentPage.value = 1
  loadItems()
})

watch(itemsPerPage, () => {
  currentPage.value = 1
  loadItems()
})

watch([sortBy, sortOrder], () => {
  loadItems()
})

watch(activeTab, (newTab) => {
  if (newTab === 'aktivitas') {
    loadLogs()
  }
})

// Formatting helpers
const formatRupiah = (val) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(val)
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Reset Filters
const resetFilters = () => {
  searchQuery.value = ''
  selectedKategori.value = ''
  sortBy.value = 'created_at'
  sortOrder.value = 'desc'
  currentPage.value = 1
  loadItems()
}

// Lifecycle Hooks
onMounted(() => {
  loadItems()
  loadCategories()
  loadMetrics()
})
</script>

<template>
  <div class="min-h-screen bg-[#f3f6fc] text-slate-700 pb-16">
    <!-- Navbar Header -->
    <Navbar />

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
      
      <!-- Metrics Overview Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        
        <!-- Total Barang -->
        <div class="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm shadow-indigo-100/30 flex items-center justify-between">
          <div>
            <span class="text-xs text-slate-400 font-bold uppercase tracking-wider block">Total Produk</span>
            <span class="text-2xl font-bold text-slate-800 block mt-1">{{ metrics.totalItems }}</span>
          </div>
          <div class="w-11 h-11 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-500 shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        </div>

        <!-- Total Stok -->
        <div class="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm shadow-indigo-100/30 flex items-center justify-between">
          <div>
            <span class="text-xs text-slate-400 font-bold uppercase tracking-wider block">Total Unit Stok</span>
            <span class="text-2xl font-bold text-slate-800 block mt-1">{{ metrics.totalStock }}</span>
          </div>
          <div class="w-11 h-11 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        <!-- Stok Menipis -->
        <div class="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm shadow-indigo-100/30 flex items-center justify-between">
          <div>
            <span class="text-xs text-slate-400 font-bold uppercase tracking-wider block">Stok Menipis</span>
            <span class="text-2xl font-bold text-amber-500 block mt-1">{{ metrics.lowStock }}</span>
          </div>
          <div class="w-11 h-11 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center text-amber-500 shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        <!-- Stok Habis -->
        <div class="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm shadow-indigo-100/30 flex items-center justify-between">
          <div>
            <span class="text-xs text-slate-400 font-bold uppercase tracking-wider block">Stok Habis</span>
            <span class="text-2xl font-bold text-rose-500 block mt-1">{{ metrics.outOfStock }}</span>
          </div>
          <div class="w-11 h-11 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center text-rose-500 shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
        </div>

      </div>

      <!-- Analytics Charts Section -->
      <AnalyticsCharts :refresh-key="refreshKey" />

      <!-- Tab Toggles (Fitur Pembeda) -->
      <div class="flex items-center space-x-1.5 bg-white border border-slate-100 p-1.5 rounded-2xl shadow-sm mb-6 max-w-md">
        <button 
          @click="activeTab = 'barang'"
          class="flex-1 text-center py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer"
          :class="activeTab === 'barang' ? 'bg-pastel-lavender-500 text-white shadow-md shadow-indigo-100' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'"
        >
          Daftar Inventaris
        </button>
        <button 
          @click="activeTab = 'aktivitas'"
          class="flex-1 text-center py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer"
          :class="activeTab === 'aktivitas' ? 'bg-pastel-lavender-500 text-white shadow-md shadow-indigo-100' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'"
        >
          Lini Masa Aktivitas
        </button>
      </div>

      <!-- TAB 1: BARANG INVENTARIS -->
      <div v-if="activeTab === 'barang'" class="space-y-6">
        <!-- Action Panel & Filter Bar -->
        <div class="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
          
          <div class="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <!-- Search & Filter Controls -->
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 flex-grow max-w-4xl">
              <!-- Search Input -->
              <div class="relative">
                <input 
                  v-model="searchQuery"
                  type="text" 
                  placeholder="Cari nama atau kode barang..."
                  class="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200"
                />
                <span class="absolute left-3.5 top-3.5 text-slate-400">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
              </div>

              <!-- Category Filter Dropdown -->
              <div>
                <select 
                  v-model="selectedKategori"
                  class="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-2xl px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 cursor-pointer"
                >
                  <option value="">Semua Kategori</option>
                  <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.nama }}</option>
                </select>
              </div>

              <!-- Sort Dropdown -->
              <div class="flex items-center space-x-2">
                <select 
                  v-model="sortBy"
                  class="bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-400 rounded-2xl px-3 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 cursor-pointer flex-grow"
                >
                  <option value="created_at">Tanggal Input</option>
                  <option value="nama_barang">Nama Barang</option>
                  <option value="kode_barang">Kode Barang</option>
                  <option value="stok">Jumlah Stok</option>
                  <option value="harga">Harga</option>
                </select>
                
                <button 
                  @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
                  class="bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-800 p-2.5 rounded-2xl transition-colors duration-200 cursor-pointer flex-shrink-0"
                  :title="sortOrder === 'asc' ? 'Urutkan Menurun' : 'Urutkan Menaik'"
                >
                  <svg v-if="sortOrder === 'desc'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                  <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Buttons Panel -->
            <div class="flex items-center space-x-3 self-end xl:self-center">
              <button 
                @click="resetFilters"
                class="bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-colors duration-200 cursor-pointer flex items-center space-x-2"
                title="Reset Filter"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
                </svg>
                <span class="hidden md:inline">Reset</span>
              </button>
              
              <button 
                @click="exportToCSV"
                :disabled="exporting"
                class="bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-colors duration-200 cursor-pointer flex items-center space-x-2 disabled:opacity-50"
                title="Ekspor ke CSV"
              >
                <svg v-if="exporting" class="animate-spin h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <svg v-else class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>{{ exporting ? 'Mengekspor...' : 'Ekspor CSV' }}</span>
              </button>

              <button 
                @click="showKategoriModal = true"
                class="bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-colors duration-200 cursor-pointer flex items-center space-x-2"
              >
                <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Kategori</span>
              </button>

              <button 
                @click="handleAdd"
                class="bg-pastel-lavender-500 hover:bg-pastel-lavender-600 text-white px-5 py-2.5 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center space-x-2 shadow-md shadow-indigo-100/50"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>Tambah Barang</span>
              </button>
            </div>
          </div>

        </div>

        <!-- Inventory Table -->
        <div class="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm shadow-indigo-100/10">
          <div class="overflow-x-auto w-full">
            <table class="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead class="bg-slate-50/80 text-slate-400 font-bold uppercase tracking-wider text-xs">
                <tr>
                  <th class="px-6 py-4">Barang</th>
                  <th class="px-6 py-4">Kode SKU</th>
                  <th class="px-6 py-4">Kategori</th>
                  <th class="px-6 py-4">Stok</th>
                  <th class="px-6 py-4">Harga Satuan</th>
                  <th class="px-6 py-4">Tgl Input</th>
                  <th class="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              
              <tbody class="divide-y divide-slate-100 text-slate-600">
                <tr v-if="loading">
                  <td colspan="7" class="px-6 py-16 text-center">
                    <div class="inline-block w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
                  </td>
                </tr>

                <tr v-else-if="items.length === 0">
                  <td colspan="7" class="px-6 py-16 text-center text-slate-400 font-medium">
                    <svg class="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v2m16 4h-2a2 2 0 00-2 2v1a2 2 0 00-2 2H8a2 2 0 00-2-2v-1a2 2 0 00-2-2H4" />
                    </svg>
                    <p class="text-sm">Tidak ada data barang ditemukan.</p>
                  </td>
                </tr>

                <tr 
                  v-else 
                  v-for="item in items" 
                  :key="item.id" 
                  class="hover:bg-slate-50/40 transition-colors duration-150"
                >
                  <!-- Photo & Name -->
                  <td class="px-6 py-4 flex items-center space-x-4 max-w-[280px]">
                    <div class="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0 relative">
                      <img 
                        v-if="item.foto_url" 
                        :src="item.foto_url" 
                        class="w-full h-full object-cover" 
                        alt="Barang"
                        loading="lazy"
                      />
                      <svg v-else class="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div class="truncate">
                      <span class="font-bold text-slate-800 block truncate" :title="item.nama_barang">{{ item.nama_barang }}</span>
                      <span class="text-xs text-slate-400 block truncate mt-0.5" :title="item.deskripsi || '-'">{{ item.deskripsi || 'Tidak ada deskripsi' }}</span>
                    </div>
                  </td>

                  <!-- SKU Code -->
                  <td class="px-6 py-4 font-mono text-xs font-bold text-indigo-500">
                    {{ item.kode_barang }}
                  </td>

                  <!-- Category -->
                  <td class="px-6 py-4">
                    <span 
                      class="px-2.5 py-1 rounded-lg text-xs font-semibold"
                      :class="[
                        item.kategori ? 'bg-pastel-pink-50 text-pastel-pink-700 border border-pastel-pink-100' : 'bg-slate-100 text-slate-400 border border-slate-200'
                      ]"
                    >
                      {{ item.kategori ? item.kategori.nama : 'Tanpa Kategori' }}
                    </span>
                  </td>

                  <!-- Stock Status Pill with Inline Quick Adjust -->
                  <td class="px-6 py-4">
                    <div class="flex items-center space-x-2">
                      <span 
                        class="px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center space-x-1"
                        :class="[
                          item.stok === 0 ? 'bg-pastel-rose-50 text-pastel-rose-700 border border-pastel-rose-100' : 
                          item.stok < 10 ? 'bg-pastel-amber-50 text-pastel-amber-700 border border-pastel-amber-100' : 
                          'bg-pastel-mint-50 text-pastel-mint-700 border border-pastel-mint-100'
                        ]"
                      >
                        <span class="w-1.5 h-1.5 rounded-full" :class="[
                          item.stok === 0 ? 'bg-pastel-rose-700' :
                          item.stok < 10 ? 'bg-pastel-amber-700' : 'bg-pastel-mint-700'
                        ]"></span>
                        <span>{{ item.stok === 0 ? 'Habis' : item.stok < 10 ? `Kritis (${item.stok})` : `Aman (${item.stok})` }}</span>
                      </span>
                      
                      <!-- Quick Adjust Buttons -->
                      <div class="flex items-center bg-slate-100/50 rounded-lg p-0.5 border border-slate-200/40">
                        <button 
                          @click.stop="quickAdjustStock(item, -1)"
                          :disabled="item.stok <= 0 || adjustingStockId === item.id"
                          class="p-1 hover:bg-white rounded-md text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-all cursor-pointer"
                          title="Kurangi Stok (1)"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                          </svg>
                        </button>
                        <button 
                          @click.stop="quickAdjustStock(item, 1)"
                          :disabled="adjustingStockId === item.id"
                          class="p-1 hover:bg-white rounded-md text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                          title="Tambah Stok (1)"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </td>

                  <!-- Price -->
                  <td class="px-6 py-4 font-bold text-slate-800">
                    {{ formatRupiah(item.harga) }}
                  </td>

                  <!-- Date Created -->
                  <td class="px-6 py-4 text-xs text-slate-400 font-medium">
                    {{ formatDate(item.created_at) }}
                  </td>

                  <!-- Actions -->
                  <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end space-x-2">
                      <button 
                        @click="handleEdit(item.id)"
                        class="text-slate-400 hover:text-indigo-500 p-1.5 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-xl transition-all duration-200 cursor-pointer"
                        title="Edit Barang"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      
                      <button 
                        @click="handleDeleteClick(item.id, item.nama_barang, item.foto_url)"
                        class="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-xl transition-all duration-200 cursor-pointer"
                        title="Hapus Barang"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination Controls -->
          <div class="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div class="text-xs text-slate-400 font-semibold">
              Menampilkan <span class="text-slate-700 font-bold">{{ items.length }}</span> dari 
              <span class="text-slate-700 font-bold">{{ totalItems }}</span> produk
            </div>

            <div class="flex items-center space-x-6">
              <!-- Limit -->
              <div class="flex items-center space-x-2">
                <span class="text-xs text-slate-400 font-semibold">Baris:</span>
                <select 
                  v-model.number="itemsPerPage" 
                  class="bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs text-slate-600 outline-none cursor-pointer hover:border-slate-300"
                >
                  <option :value="10">10</option>
                  <option :value="25">25</option>
                  <option :value="50">50</option>
                </select>
              </div>

              <!-- Pages -->
              <div class="flex items-center space-x-1.5" v-if="totalPages > 1">
                <button 
                  @click="changePage(currentPage - 1)" 
                  :disabled="currentPage === 1"
                  class="bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-40 text-slate-600 p-2 rounded-xl text-xs transition-colors duration-200 cursor-pointer shadow-sm"
                >
                  <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <span class="text-xs text-slate-500 font-semibold px-2">
                  Halaman {{ currentPage }} dari {{ totalPages }}
                </span>

                <button 
                  @click="changePage(currentPage + 1)" 
                  :disabled="currentPage === totalPages"
                  class="bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-40 text-slate-600 p-2 rounded-xl text-xs transition-colors duration-200 cursor-pointer shadow-sm"
                >
                  <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- TAB 2: LOG AKTIVITAS (Fitur Pembeda / Audit Trail) -->
      <div v-else class="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm shadow-indigo-100/10 space-y-6">
        <div class="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 class="text-lg font-bold text-slate-800">Lini Masa Log Aktivitas</h3>
            <p class="text-xs text-slate-400 mt-1">Audit log perubahan inventaris yang dicatat secara real-time demi integritas data.</p>
          </div>
          <button 
            @click="loadLogs"
            class="bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center space-x-2"
          >
            <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
            </svg>
            <span>Segarkan</span>
          </button>
        </div>

        <div v-if="logsLoading" class="flex flex-col items-center justify-center py-16">
          <div class="w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>

        <div v-else-if="activityLogs.length === 0" class="text-center py-16 text-slate-400">
          <svg class="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-sm font-semibold">Belum ada riwayat aktivitas yang tercatat.</p>
        </div>

        <!-- Vertical Timeline -->
        <div v-else class="relative border-l-2 border-slate-100 ml-4 pl-8 space-y-6 py-2">
          <div 
            v-for="log in activityLogs" 
            :key="log.id" 
            class="relative group"
          >
            <!-- Dot -->
            <span 
              class="absolute -left-[41px] top-1.5 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center shadow-sm"
              :class="[
                log.action.includes('TAMBAH') ? 'bg-pastel-mint-100 text-pastel-mint-700' :
                log.action.includes('HAPUS') ? 'bg-pastel-rose-100 text-pastel-rose-700' :
                'bg-pastel-lavender-100 text-pastel-lavender-500'
              ]"
            >
              <span class="w-1.5 h-1.5 rounded-full" :class="[
                log.action.includes('TAMBAH') ? 'bg-pastel-mint-700' :
                log.action.includes('HAPUS') ? 'bg-pastel-rose-700' :
                'bg-pastel-lavender-500'
              ]"></span>
            </span>

            <!-- Content Card -->
            <div class="bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-2xl p-4 transition-all duration-200">
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <!-- Action Badge & Operator -->
                <div class="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span 
                    class="px-2.5 py-0.5 rounded-lg text-[10px] font-bold tracking-wide uppercase border"
                    :class="[
                      log.action.includes('TAMBAH') ? 'bg-pastel-mint-50 text-pastel-mint-700 border-pastel-mint-100' :
                      log.action.includes('HAPUS') ? 'bg-pastel-rose-50 text-pastel-rose-700 border-pastel-rose-100' :
                      'bg-pastel-lavender-50 text-pastel-lavender-500 border-pastel-lavender-100'
                    ]"
                  >
                    {{ log.action }}
                  </span>
                  <span class="text-xs text-slate-500 font-medium">oleh <strong class="text-slate-600 font-semibold">{{ log.user_email }}</strong></span>
                </div>
                
                <!-- Timestamp -->
                <div class="text-[11px] text-slate-400 font-semibold">
                  {{ formatDateTime(log.created_at) }}
                </div>
              </div>

              <!-- Log Description Details -->
              <p class="text-sm text-slate-600 mt-2 font-medium leading-relaxed">
                {{ log.detail }}
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Modals -->
    <BarangFormModal 
      :show="showFormModal"
      :barang-id="activeBarangId"
      @close="showFormModal = false"
      @saved="() => { loadItems(); loadMetrics(); refreshKey++; if (activeTab === 'aktivitas') { loadLogs(); } }"
    />

    <KategoriModal 
      :show="showKategoriModal"
      @close="showKategoriModal = false"
      @refresh="() => { loadCategories(); loadItems(); refreshKey++; if (activeTab === 'aktivitas') { loadLogs(); } }"
    />

    <!-- Custom Delete Barang Confirmation Modal -->
    <ConfirmModal 
      :show="showDeleteConfirm"
      title="Hapus Barang"
      :message="`Apakah Anda yakin ingin menghapus barang '${deleteConfirmData.nama}'? Tindakan ini tidak dapat dibatalkan.`"
      type="danger"
      confirm-text="Ya, Hapus"
      cancel-text="Batal"
      @confirm="executeDeleteBarang"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>
