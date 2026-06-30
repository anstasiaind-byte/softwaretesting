import { supabase } from '../supabase'

// Helper to format currency inside logs
const logFormatRupiah = (val) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(val)
}

/**
 * --- AKTIVITAS LOG SERVICES (Fitur Pembeda) ---
 */

// Add custom log entry
export const addLog = async (action, detail) => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const email = session?.user?.email || 'sistem@inventaris.com'
    
    await supabase
      .from('aktivitas')
      .insert([{
        user_email: email,
        action,
        detail
      }])
  } catch (err) {
    console.error('Peringatan: Gagal menyimpan log aktivitas:', err)
  }
}

// Fetch recent activity logs
export const fetchAktivitas = async () => {
  const { data, error } = await supabase
    .from('aktivitas')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100) // Limit to last 100 logs

  if (error) throw error
  return data
}


/**
 * --- KATEGORI SERVICES ---
 */

// Fetch all categories
export const fetchKategori = async () => {
  const { data, error } = await supabase
    .from('kategori')
    .select('*')
    .order('nama', { ascending: true })

  if (error) throw error
  return data
}

// Create category
export const createKategori = async (nama, deskripsi) => {
  const { data, error } = await supabase
    .from('kategori')
    .insert([{ nama, deskripsi }])
    .select()

  if (error) throw error
  const newCat = data[0]
  
  // Log activity
  await addLog('TAMBAH_KATEGORI', `Membuat kategori baru: "${newCat.nama}"`)
  
  return newCat
}

// Update category
export const updateKategori = async (id, nama, deskripsi) => {
  const { data, error } = await supabase
    .from('kategori')
    .update({ nama, deskripsi })
    .eq('id', id)
    .select()

  if (error) throw error
  const updatedCat = data[0]
  
  // Log activity
  await addLog('EDIT_KATEGORI', `Mengubah kategori: "${updatedCat.nama}"`)
  
  return updatedCat
}

// Delete category
export const deleteKategori = async (id) => {
  // Fetch old name first for logging
  const { data: oldCat } = await supabase.from('kategori').select('nama').eq('id', id).single()
  
  const { error } = await supabase
    .from('kategori')
    .delete()
    .eq('id', id)

  if (error) throw error
  
  if (oldCat) {
    await addLog('HAPUS_KATEGORI', `Menghapus kategori: "${oldCat.nama}"`)
  }
  
  return true
}


/**
 * --- BARANG SERVICES ---
 */

// Fetch items with paginated search, filter, and sorting
export const fetchBarang = async ({
  page = 1,
  limit = 10,
  search = '',
  kategoriId = null,
  sortBy = 'created_at',
  sortOrder = 'desc'
}) => {
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('barang')
    .select('*, kategori(id, nama)', { count: 'exact' })

  // Search filter (handles both item name and code)
  if (search.trim()) {
    query = query.or(`nama_barang.ilike.%${search}%,kode_barang.ilike.%${search}%`)
  }

  // Category filter
  if (kategoriId) {
    query = query.eq('kategori_id', kategoriId)
  }

  // Sorting
  query = query.order(sortBy, { ascending: sortOrder === 'asc' })

  // Pagination bounds
  query = query.range(from, to)

  const { data, count, error } = await query

  if (error) throw error
  return {
    items: data,
    totalItems: count,
    totalPages: Math.ceil(count / limit),
    currentPage: page
  }
}

// Create new item
export const createBarang = async (barangData) => {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id

  const payload = {
    ...barangData,
    created_by: userId,
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('barang')
    .insert([payload])
    .select()

  if (error) throw error
  const newItem = data[0]

  // Log activity
  await addLog(
    'TAMBAH_BARANG', 
    `Menambahkan produk baru: ${newItem.nama_barang} (${newItem.kode_barang}) dengan stok awal ${newItem.stok} unit seharga ${logFormatRupiah(newItem.harga)}/unit.`
  )

  return newItem
}

// Update existing item
export const updateBarang = async (id, barangData) => {
  // Fetch the old data first for detailed change logs
  const { data: oldItem } = await supabase.from('barang').select('nama_barang, kode_barang, stok, harga').eq('id', id).single()

  const payload = {
    ...barangData,
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('barang')
    .update(payload)
    .eq('id', id)
    .select()

  if (error) throw error
  const updatedItem = data[0]

  // Detect and log stock changes or price changes specifically
  let logDetail = `Mengubah info barang ${updatedItem.nama_barang} (${updatedItem.kode_barang}).`
  if (oldItem) {
    const stockChange = updatedItem.stok - oldItem.stok
    if (stockChange !== 0) {
      logDetail += ` Stok disesuaikan dari ${oldItem.stok} ke ${updatedItem.stok} (Perubahan: ${stockChange > 0 ? '+' : ''}${stockChange} unit).`
    }
    if (Number(oldItem.harga) !== Number(updatedItem.harga)) {
      logDetail += ` Harga diubah dari ${logFormatRupiah(oldItem.harga)} ke ${logFormatRupiah(updatedItem.harga)}.`
    }
  }

  await addLog('EDIT_BARANG', logDetail)
  return updatedItem
}

// Delete item
export const deleteBarang = async (id) => {
  // Fetch details first for logging
  const { data: oldItem } = await supabase.from('barang').select('nama_barang, kode_barang').eq('id', id).single()

  const { error } = await supabase
    .from('barang')
    .delete()
    .eq('id', id)

  if (error) throw error

  if (oldItem) {
    await addLog(
      'HAPUS_BARANG', 
      `Menghapus barang dari daftar: ${oldItem.nama_barang} (${oldItem.kode_barang}).`
    )
  }

  return true
}


/**
 * --- STORAGE / PHOTO SERVICES ---
 */

// Helper to extract file path from public Supabase Storage URL
const getFilePathFromUrl = (url) => {
  if (!url) return null
  try {
    const parts = url.split('/barang-photos/')
    if (parts.length > 1) {
      return parts[1]
    }
  } catch (err) {
    console.error('Failed to extract file path from URL:', err)
  }
  return null
}

// Upload a photo file and return the public access URL
export const uploadFotoBarang = async (file) => {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`
  const filePath = `${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('barang-photos')
    .upload(filePath, file)

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from('barang-photos')
    .getPublicUrl(filePath)

  return data.publicUrl
}

// Delete a photo from Supabase Storage by its public URL
export const deleteFotoBarang = async (fotoUrl) => {
  const filePath = getFilePathFromUrl(fotoUrl)
  if (!filePath) return false

  const { error } = await supabase.storage
    .from('barang-photos')
    .remove([filePath])

  if (error) throw error
  return true
}
