-- -------------------------------------------------------------
-- SKRIP DATABASE UNTUK SUPABASE: INVENTARIS BARANG
-- Jalankan skrip ini di SQL Editor Supabase Anda
-- -------------------------------------------------------------

-- 1. Hapus tabel jika sudah ada (untuk memulai dari awal jika diperlukan)
DROP TABLE IF EXISTS barang;
DROP TABLE IF EXISTS kategori;

-- 2. Buat Tabel Kategori (Kategori Terstruktur)
CREATE TABLE kategori (
    id SERIAL PRIMARY KEY,
    nama VARCHAR(100) NOT NULL UNIQUE,
    deskripsi TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Buat Tabel Barang (Data Inventaris)
CREATE TABLE barang (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode_barang VARCHAR(50) NOT NULL UNIQUE,
    nama_barang VARCHAR(100) NOT NULL,
    deskripsi TEXT,
    stok INT NOT NULL DEFAULT 0 CHECK (stok >= 0),
    harga NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (harga >= 0),
    foto_url TEXT,
    kategori_id INT REFERENCES kategori(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Isi Kategori Awal (Seed Kategori)
INSERT INTO kategori (nama, deskripsi) VALUES
('Elektronik', 'Peralatan elektronik, komputer, dan aksesorisnya'),
('Peralatan Kantor', 'Alat tulis, perlengkapan meja, dan furnitur kantor'),
('Bahan Baku', 'Material industri dan bahan dasar produksi'),
('Konsumsi', 'Kebutuhan harian, makanan, minuman, dan sanitasi kantor'),
('Keamanan', 'Peralatan perlindungan diri, pertolongan pertama, dan alat pemadam');

-- 5. Aktifkan Row Level Security (RLS)
ALTER TABLE kategori ENABLE ROW LEVEL SECURITY;
ALTER TABLE barang ENABLE ROW LEVEL SECURITY;

-- 6. Kebijakan RLS (Policy) untuk Kategori
-- Izinkan semua user terautentikasi (authenticated) untuk membaca
CREATE POLICY "Izinkan baca kategori bagi user login" 
ON kategori FOR SELECT 
TO authenticated 
USING (true);

-- Izinkan semua user terautentikasi (authenticated) untuk memodifikasi kategori
CREATE POLICY "Izinkan modifikasi kategori bagi user login" 
ON kategori FOR ALL 
TO authenticated 
USING (true);

-- 7. Kebijakan RLS (Policy) untuk Barang
-- Izinkan semua user terautentikasi (authenticated) untuk membaca barang
CREATE POLICY "Izinkan baca barang bagi user login" 
ON barang FOR SELECT 
TO authenticated 
USING (true);

-- Izinkan semua user terautentikasi (authenticated) untuk memodifikasi barang
CREATE POLICY "Izinkan modifikasi barang bagi user login" 
ON barang FOR ALL 
TO authenticated 
USING (true);

-- 8. Kebijakan Storage (Supabase Storage RLS) untuk Foto Barang
-- Catatan: Pastikan Anda telah membuat bucket bernama 'barang-photos' terlebih dahulu di panel Supabase Storage.
-- Berikan izin akses publik membaca file, serta modifikasi file hanya untuk user terautentikasi.
-- Skrip di bawah ini opsional jika Anda mengaktifkan bucket secara "Public" di UI Dashboard Supabase.

-- 9. Buat Tabel Aktivitas Log (Fitur Pembeda / Audit Trail)
DROP TABLE IF EXISTS aktivitas;
CREATE TABLE aktivitas (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'TAMBAH', 'EDIT', 'HAPUS'
    detail TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aktifkan RLS
ALTER TABLE aktivitas ENABLE ROW LEVEL SECURITY;

-- Kebijakan RLS (Policy) untuk Aktivitas
CREATE POLICY "Izinkan baca log aktivitas bagi user login" 
ON aktivitas FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Izinkan tulis log aktivitas bagi user login" 
ON aktivitas FOR INSERT 
TO authenticated 
WITH CHECK (true);
