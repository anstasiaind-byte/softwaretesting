import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Helper to load .env variables in plain Node.js
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.resolve(__dirname, '../.env')

const env = {}
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (match) {
      let value = match[2] ? match[2].trim() : ''
      // Remove surrounding quotes if present
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
      env[match[1]] = value
    }
  })
}

const supabaseUrl = env.VITE_SUPABASE_URL
// Prefer Service Role Key for admin seeding (bypasses RLS), fallback to Anon Key
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-supabase-project')) {
  console.error('Error: Silakan konfigurasikan VITE_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY/VITE_SUPABASE_ANON_KEY di file .env terlebih dahulu.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Mock Data Generators
const adjectives = ['Premium', 'Super', 'Ultra', 'Hemat', 'Ekonomis', 'Profesional', 'Eksklusif', 'Modern', 'Portabel', 'Mewah']
const materials = ['Besi', 'Kayu', 'Plastik', 'Aluminium', 'Kaca', 'Kulit', 'Kertas', 'Semen', 'Baja', 'Katun']
const itemTypes = {
  'Elektronik': ['Laptop', 'Mouse Wireless', 'Keyboard Mekanikal', 'Monitor LED 24"', 'Smartphone', 'Printer Laserjet', 'Speaker Bluetooth', 'Proyektor', 'Router Wi-Fi', 'Kabel HDMI'],
  'Peralatan Kantor': ['Meja Kerja', 'Kursi Ergonomis', 'Lemari Arsip', 'Papan Tulis Whiteboard', 'Filing Cabinet', 'Stapler Besar', 'Gunting Kertas', 'Pena Gel Box', 'Kertas HVS A4', 'Map Snelhechter'],
  'Bahan Baku': ['Semen Portland', 'Pasir Beton', 'Besi Beton', 'Cat Tembok 5kg', 'Pipa PVC 2"', 'Triplek 9mm', 'Batu Bata Merah', 'Kawat Las', 'Kayu Kaso', 'Baut & Mur Box'],
  'Konsumsi': ['Kopi Bubuk 500g', 'Teh Celup Box', 'Gula Pasir 1kg', 'Air Mineral Galon', 'Susu UHT Karton', 'Biskuit Kaleng', 'Sabun Cuci Tangan', 'Tissue Wajah Pack', 'Mie Instan Dus', 'Kopi Instan Box'],
  'Keamanan': ['Helm Proyek', 'Rompi Safety', 'Sepatu Boot Safety', 'Sarung Tangan Las', 'Alat Pemadam Api (APAR)', 'Kacamata Safety', 'Masker Respirator', 'P3K Box lengkap', 'Traffic Cone', 'Gembok Stainless']
}

const generateRandomItemName = (categoryName) => {
  const types = itemTypes[categoryName] || ['Barang']
  const type = types[Math.floor(Math.random() * types.length)]
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const mat = materials[Math.floor(Math.random() * materials.length)]
  
  // Mix configurations
  const rand = Math.random()
  if (rand < 0.3) {
    return `${type} ${adj}`
  } else if (rand < 0.6) {
    return `${type} ${mat}`
  } else {
    return `${type} ${mat} ${adj}`
  }
}

const seed = async () => {
  console.log('=== MEMULAI PROSES SEEDING DATA BARANG ===')
  
  try {
    // 0. Authenticate seeder user to satisfy RLS authenticated policy
    console.log('Autentikasi seeder...')
    let session = null
    
    const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously()
    
    if (anonError) {
      console.warn('Peringatan: Gagal login anonim:', anonError.message)
      console.log('Mencoba mendaftarkan operator seeder via email...')
      const email = 'operator-seeder@inventrack.com'
      const password = 'SeederPassword123!'
      
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) {
        throw new Error('Gagal registrasi seeder: ' + signUpError.message)
      }
      
      session = signUpData.session
      if (!session) {
        const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({ email, password })
        if (retryError) {
          throw new Error(
            'Gagal autentikasi seeder karena "Email not confirmed".\n' +
            'Untuk menjalankan seeder 2.000 data ini, silakan jalankan SQL berikut di dashboard Supabase Anda terlebih dahulu:\n\n' +
            '  ALTER TABLE kategori DISABLE ROW LEVEL SECURITY;\n' +
            '  ALTER TABLE barang DISABLE ROW LEVEL SECURITY;\n\n' +
            'Lalu jalankan ulang script seeder ini. Setelah selesai, aktifkan kembali dengan:\n\n' +
            '  ALTER TABLE kategori ENABLE ROW LEVEL SECURITY;\n' +
            '  ALTER TABLE barang ENABLE ROW LEVEL SECURITY;'
          )
        }
        session = retryData.session
      }
    } else {
      session = anonData.session
    }

    console.log('Autentikasi seeder berhasil.')

    // 1. Dapatkan atau buat kategori
    let { data: categories, error: catError } = await supabase.from('kategori').select('*')
    if (catError) throw catError

    if (!categories || categories.length === 0) {
      console.log('Kategori kosong, membuat kategori default terlebih dahulu...')
      const defaultCategories = Object.keys(itemTypes).map(name => ({
        nama: name,
        deskripsi: `Kategori untuk barang-barang ${name.toLowerCase()}`
      }))

      const { data: newCategories, error: insertCatError } = await supabase
        .from('kategori')
        .insert(defaultCategories)
        .select()

      if (insertCatError) throw insertCatError
      categories = newCategories
      console.log(`Berhasil membuat ${categories.length} kategori default.`)
    } else {
      console.log(`Ditemukan ${categories.length} kategori di database.`)
    }

    // 2. Bersihkan data barang lama (opsional, untuk reset)
    console.log('Membersihkan data barang yang sudah ada...')
    const { error: cleanError } = await supabase.from('barang').delete().neq('id', '00000000-0000-0000-0000-000000000000') // Hapus semua
    if (cleanError) {
      console.warn('Peringatan: Gagal membersihkan barang lama (mungkin karena RLS). Melanjutkan insert...', cleanError.message)
    }

    // 3. Generate 2000 barang
    console.log('Membuat data 2000 barang...')
    const itemsToInsert = []
    
    for (let i = 1; i <= 2000; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)]
      const nama = generateRandomItemName(category.nama)
      
      // Pad counter with leading zeros to make unique codes like BRG-00001
      const padIndex = String(i).padStart(5, '0')
      const kode = `BRG-${padIndex}`

      const stok = Math.floor(Math.random() * 150) // 0 - 149
      
      // Price range based on category to make it realistic
      let basePrice = 10000
      if (category.nama === 'Elektronik') basePrice = 1500000
      else if (category.nama === 'Peralatan Kantor') basePrice = 75000
      else if (category.nama === 'Bahan Baku') basePrice = 50000
      else if (category.nama === 'Keamanan') basePrice = 120000

      const harga = Math.round((basePrice + (Math.random() * basePrice * 2)) / 500) * 500 // round to nearest 500

      // Use Picsum Photos for placeholders (different ID to trigger unique random images)
      // Category names translate to search keywords for relevance
      const keyword = category.nama === 'Elektronik' ? 'tech,computer' : 
                      category.nama === 'Peralatan Kantor' ? 'office,stationery' : 
                      category.nama === 'Bahan Baku' ? 'industrial,construction' :
                      category.nama === 'Konsumsi' ? 'food,beverage' : 'safety,security'
                      
      const fotoUrl = `https://picsum.photos/400/300?random=${i}`

      itemsToInsert.push({
        kode_barang: kode,
        nama_barang: nama,
        deskripsi: `Spesifikasi detail untuk ${nama} dari kategori ${category.nama}. Kualitas terjamin dan bergaransi resmi.`,
        stok,
        harga,
        foto_url: fotoUrl,
        kategori_id: category.id
      })
    }

    // 4. Insert ke database dalam beberapa batch agar tidak melebihi batas request payload
    console.log('Mengunggah data barang ke database...')
    const batchSize = 100
    for (let i = 0; i < itemsToInsert.length; i += batchSize) {
      const batch = itemsToInsert.slice(i, i + batchSize)
      const { error: insertError } = await supabase.from('barang').insert(batch)
      
      if (insertError) throw insertError
      console.log(`Inserted batch ${i / batchSize + 1} (${i + batch.length}/2000)`)
    }

    console.log('=== SEEDING SELESAI DENGAN SUKSES! ===')
    console.log('Silakan jalankan frontend Anda untuk melihat data 2000 barang.')
  } catch (err) {
    console.error('Terjadi error selama seeding:', err.message || err)
    process.exit(1)
  }
}

seed()
