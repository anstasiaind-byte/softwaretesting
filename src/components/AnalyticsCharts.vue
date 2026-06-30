<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { supabase } from '../supabase'

const props = defineProps({
  refreshKey: Number // Used to trigger refresh when items are modified
})

const loading = ref(true)
const dataLoaded = ref(false)

const metrics = reactive({
  aman: 0,
  kritis: 0,
  habis: 0,
  totalItems: 0
})

const categoryData = ref([])

const loadChartData = async () => {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('barang')
      .select('stok, kategori(nama)')

    if (error) throw error

    if (data) {
      // 1. Reset metrics
      metrics.aman = 0
      metrics.kritis = 0
      metrics.habis = 0
      metrics.totalItems = data.length

      // 2. Count stock status
      const catStockCounts = {}

      data.forEach(item => {
        const stok = item.stok || 0
        if (stok === 0) {
          metrics.habis++
        } else if (stok < 10) {
          metrics.kritis++
        } else {
          metrics.aman++
        }

        // Aggregate stock by category
        const catName = item.kategori?.nama || 'Tanpa Kategori'
        catStockCounts[catName] = (catStockCounts[catName] || 0) + stok
      })

      // 3. Process category stock data for top 5 categories
      const processedCats = Object.entries(catStockCounts)
        .map(([name, stock]) => ({ name, stock }))
        .sort((a, b) => b.stock - a.stock)
        .slice(0, 5)

      categoryData.value = processedCats
      dataLoaded.value = true
    }
  } catch (err) {
    console.error('Gagal mengambil data analitik:', err)
  } finally {
    loading.value = false
  }
}

// Donut Chart Computations
const getDonutSegments = () => {
  const total = metrics.aman + metrics.kritis + metrics.habis
  if (total === 0) return []

  const pAman = (metrics.aman / total) * 100
  const pKritis = (metrics.kritis / total) * 100
  const pHabis = (metrics.habis / total) * 100

  // Segments with cumulative offset (circumference of 100)
  // SVG stroke-dashoffset: 0 starts at 3 o'clock (right). Offset of 25 moves start to 12 o'clock (top) counter-clockwise.
  // We can start offsets and cumulative sums.
  let currentOffset = 25

  const segments = []
  
  if (pAman > 0) {
    segments.push({
      percentage: pAman,
      dashArray: `${pAman} ${100 - pAman}`,
      dashOffset: currentOffset,
      colorClass: 'stroke-emerald-400',
      label: 'Aman',
      count: metrics.aman
    })
    currentOffset -= pAman
  }

  if (pKritis > 0) {
    segments.push({
      percentage: pKritis,
      dashArray: `${pKritis} ${100 - pKritis}`,
      dashOffset: currentOffset,
      colorClass: 'stroke-amber-400',
      label: 'Kritis',
      count: metrics.kritis
    })
    currentOffset -= pKritis
  }

  if (pHabis > 0) {
    segments.push({
      percentage: pHabis,
      dashArray: `${pHabis} ${100 - pHabis}`,
      dashOffset: currentOffset,
      colorClass: 'stroke-rose-400',
      label: 'Habis',
      count: metrics.habis
    })
  }

  return segments
}

// Max stock for bar chart normalization
const getMaxCategoryStock = () => {
  if (categoryData.value.length === 0) return 100
  const max = Math.max(...categoryData.value.map(c => c.stock))
  return max === 0 ? 100 : max
}

watch(() => props.refreshKey, () => {
  loadChartData()
})

onMounted(() => {
  loadChartData()
})
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
    <!-- Donut Chart Card -->
    <div class="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm shadow-indigo-100/30 flex flex-col justify-between min-h-[300px]">
      <div>
        <h4 class="text-sm font-bold text-slate-800">Status Ketersediaan Produk</h4>
        <p class="text-xs text-slate-400 mt-1">Proporsi status stok seluruh inventaris barang.</p>
      </div>

      <div v-if="loading" class="flex flex-col items-center justify-center flex-grow py-8">
        <div class="w-8 h-8 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>

      <div v-else-if="metrics.totalItems === 0" class="text-center py-8 text-slate-400 flex-grow flex flex-col justify-center items-center">
        <p class="text-xs">Belum ada data barang untuk grafik.</p>
      </div>

      <div v-else class="flex flex-row items-center justify-around flex-grow mt-4">
        <!-- SVG Donut -->
        <div class="relative w-32 h-32 flex-shrink-0">
          <svg viewBox="0 0 36 36" class="w-full h-full transform -rotate-90">
            <!-- Background circle -->
            <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f1f5f9" stroke-width="2.5"></circle>
            
            <!-- Segments -->
            <circle 
              v-for="(seg, idx) in getDonutSegments()" 
              :key="idx"
              cx="18" 
              cy="18" 
              r="15.915" 
              fill="transparent" 
              :class="seg.colorClass"
              stroke-width="3" 
              :stroke-dasharray="seg.dashArray" 
              :stroke-dashoffset="seg.dashOffset"
              class="transition-all duration-500 ease-out cursor-pointer hover:stroke-[3.5px]"
              stroke-linecap="round"
            />
          </svg>
          <!-- Central text -->
          <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span class="text-xs text-slate-400 font-bold uppercase tracking-wider">Total</span>
            <span class="text-lg font-bold text-slate-800">{{ metrics.totalItems }}</span>
          </div>
        </div>

        <!-- Legend -->
        <div class="flex flex-col space-y-2 justify-center ml-2">
          <div 
            v-for="(seg, idx) in getDonutSegments()" 
            :key="idx" 
            class="flex items-center space-x-2 text-xs"
          >
            <span 
              class="w-3 h-3 rounded-full flex-shrink-0"
              :class="[
                seg.label === 'Aman' ? 'bg-emerald-400' :
                seg.label === 'Kritis' ? 'bg-amber-400' : 'bg-rose-400'
              ]"
            ></span>
            <div class="flex flex-col">
              <span class="font-bold text-slate-700">{{ seg.label }}</span>
              <span class="text-[10px] text-slate-400 font-semibold">{{ seg.count }} barang ({{ Math.round(seg.percentage) }}%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bar Chart Card (Stock Capacity per Category) -->
    <div class="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm shadow-indigo-100/30 lg:col-span-2 flex flex-col justify-between min-h-[300px]">
      <div>
        <h4 class="text-sm font-bold text-slate-800">5 Kategori Dengan Stok Terbanyak</h4>
        <p class="text-xs text-slate-400 mt-1">Perbandingan jumlah unit stok pada kategori paling dominan.</p>
      </div>

      <div v-if="loading" class="flex flex-col items-center justify-center flex-grow py-8">
        <div class="w-8 h-8 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>

      <div v-else-if="categoryData.length === 0" class="text-center py-8 text-slate-400 flex-grow flex flex-col justify-center items-center">
        <p class="text-xs">Belum ada data stok kategori untuk grafik.</p>
      </div>

      <!-- Horizontal Custom SVG Bars -->
      <div v-else class="flex-grow flex flex-col justify-end space-y-4 mt-6">
        <div 
          v-for="(cat, idx) in categoryData" 
          :key="idx"
          class="space-y-1"
        >
          <div class="flex items-center justify-between text-xs font-semibold">
            <span class="text-slate-600">{{ cat.name }}</span>
            <span class="text-slate-800 font-bold">{{ cat.stock }} <span class="text-slate-400 font-medium">Unit</span></span>
          </div>
          <!-- Bar container -->
          <div class="w-full bg-slate-50 border border-slate-100 h-3 rounded-full overflow-hidden relative">
            <!-- Animated Inner Bar -->
            <div 
              class="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r"
              :class="[
                idx === 0 ? 'from-indigo-400 to-indigo-500 shadow-indigo-100' :
                idx === 1 ? 'from-pastel-pink-300 to-pastel-pink-700 shadow-pink-100' :
                idx === 2 ? 'from-pastel-mint-200 to-pastel-mint-700 shadow-emerald-100' :
                idx === 3 ? 'from-pastel-blue-100 to-pastel-blue-700 shadow-blue-100' :
                'from-amber-400 to-amber-500 shadow-amber-100'
              ]"
              :style="{ width: `${(cat.stock / getMaxCategoryStock()) * 100}%` }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-pulse-slow {
  animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .8; }
}
</style>
