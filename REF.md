# Wireframe.code: Dokumentasi

Dokumen ini punya dua bagian: **A. Referensi syntax** (untuk memakai) dan **B. Panduan pengembangan** (untuk mengubah kode).

---

# A. Referensi Syntax

## A1. Aturan dasar

Satu baris = satu komponen. Indentasi menentukan hierarki.

```
tipe "arg0" "arg1" key=value flag
```

| Bagian | Bentuk | Arti |
| --- | --- | --- |
| **tipe** | kata bare pertama | Nama komponen (tidak case-sensitive) |
| **arg** | `"teks"` | Argumen posisional: arg0, arg1, dst. Tidak bisa berisi tanda `"` |
| **prop** | `key=value` atau `key="a b"` | Properti bernama |
| **flag** | kata bare setelah tipe | Saklar boolean, misalnya `primary`, `checked` |
| **komentar** | baris diawali `#` | Diabaikan, baris kosong juga |

- **Indentasi**: 2 spasi = 1 level. Tab dihitung 2 spasi. Baris yang lebih menjorok adalah anak dari baris di atasnya.
- **Daftar item** ditulis dalam satu string dipisah `|`, misalnya `"Home|About|Contact"`.
- **Indeks `active`** dimulai dari 1.
- **Komponen leaf** (button, input, dst.) mengabaikan anak. Hanya container yang merender anak.
- **Tipe tidak dikenal** tampil sebagai kotak merah putus-putus `? namatipe`.

## A2. Properti universal

Berlaku untuk semua komponen:

| Prop | Efek |
| --- | --- |
| `w=200` | Lebar 200px dan tidak ikut membagi ruang di `row` |
| `h=120` | Tinggi minimum 120px |
| `flex=2` | Bagian ruang relatif di dalam `row` |

Anak langsung dari `row` otomatis dibagi rata (`flex: 1 1 0`), **kecuali** yang punya `w`/`flex`, atau bertipe kecil/inline: `button iconbtn fab link badge chip avatar checkbox radio toggle sidebar spinner tooltip toast`.

## A3. Komponen

Kolom *Anak?* = **ya** berarti komponen itu container.

### Struktur & navigasi

| Tipe | Args | Prop / flag | Anak? |
| --- | --- | --- | --- |
| `screen` | arg0 judul | flag `mobile` \| `tablet` \| `desktop` (default desktop; lebar 375/640/900px) | ya |
| `row` / `col` | - | - | ya |
| `header` | arg0 brand, arg1 item nav | flag `menu` (ikon ☰) | - |
| `footer` | arg0 teks, arg1 tautan | - | - |
| `sidebar` | arg0 judul, arg1 item menu | `active=N` | ya |
| `bottomnav` | arg0 item | `active=N` | - |
| `breadcrumb` | arg0 item | - | - |
| `pagination` | - | `pages=5` `active=1` | - |
| `tabs` | arg0 nama tab | `active=1` | ya (isi panel) |

### Input & formulir

| Tipe | Args | Prop / flag |
| --- | --- | --- |
| `input` | arg0 label | `placeholder=` `value=` |
| `textarea` | arg0 label | `placeholder=` `value=` `rows=3` |
| `select` | arg0 label | `value=` (default "Pilih…") |
| `search` | arg0 placeholder | - |
| `checkbox` / `radio` | arg0 label | flag `checked` |
| `toggle` | arg0 label | flag `on` |
| `slider` | arg0 label | `value=0..100` (default 50) |

### Aksi

| Tipe | Args | Prop / flag |
| --- | --- | --- |
| `button` | arg0 teks | flag `primary` (solid), `wide` (selebar parent) |
| `iconbtn` | arg0 simbol (default ★) | - |
| `fab` | arg0 simbol (default +) | - |
| `link` | arg0 teks | - |

### Data & konten

| Tipe | Args | Prop / flag | Anak? |
| --- | --- | --- | --- |
| `card` | arg0 judul (opsional) | - | ya |
| `list` | - | - | ya (isi `item`) |
| `item` | arg0 judul, arg1 subjudul | flag `noicon` | - |
| `table` | arg0 nama kolom | - | hanya `tr` |
| `tr` | arg0 isi sel | - | - |
| `accordion` | arg0 judul | flag `open` | ya (tampil hanya jika `open`) |
| `avatar` | arg0 inisial (maks 2 huruf) | `size=40` | - |
| `badge` / `chip` | arg0 teks (chip ada tanda ×) | - | - |
| `heading` | arg0 teks | flag `h1` \| `h2` \| `h3` (default h2) | - |
| `text` | arg0 teks | - | - |
| `divider` | - | - | - |

### Umpan balik

| Tipe | Args | Prop / flag | Anak? |
| --- | --- | --- | --- |
| `modal` | arg0 judul | - | ya |
| `tooltip` | arg0 teks | - | - |
| `alert` | arg0 pesan | flag `success` \| `warning` \| `error` (default info) | - |
| `toast` | arg0 pesan | - | - |
| `progress` | - | `value=50` | - |
| `spinner` | - | - | - |

### Placeholder low-fi

| Tipe | Args | Prop |
| --- | --- | --- |
| `image` | arg0 label | `h=100` (kotak silang X) |
| `skeleton` | - | `lines=3` |
| `lorem` | - | `lines=3` (garis teks, baris terakhir lebih pendek) |

## A4. Contoh lengkap

```
screen "Katalog" mobile
  header "Toko" menu
  search "Cari sepatu…"
  row
    chip "Pria"
    chip "Wanita"
  card "Sepatu Lari"
    image "Foto" h=90
    lorem lines=2
    row
      badge "Diskon"
      button "Beli" primary
  pagination pages=3 active=1
  fab "+"
  bottomnav "Home|Cari|Keranjang|Profil" active=1
```

## A5. Jebakan umum

- **Tipe harus kata bare pertama.** Jika baris dimulai dengan `"teks"`, string itu dianggap arg dan tipe diambil dari kata bare berikutnya.
- **Tanda kutip tidak bisa di-escape.** Pakai tanda lain (`'`, «») di dalam teks.
- **Indentasi ganjil** (misalnya 3 spasi) dibulatkan ke bawah, jadi 3 spasi = 1 level.
- **`tr` hanya bekerja di dalam `table`**, di luar itu muncul sebagai tipe tidak dikenal.

---

# B. Panduan Pengembangan

## B1. Model domain

Pikirkan seperti HTML yang diganti indentasi. `parse` adalah browser parser, `R` adalah kamus *tag → cara menggambar*.

```
teks DSL ──parse()──▶ AST (Node) ──render()──▶ DOM
```

Satu-satunya entitas data adalah **Node**:

```ts
type Node = {
  type: string;                    // "button"
  args: string[];                  // ["Simpan"]        ← "string" posisional
  props: Record<string, string>;   // {w:"200"}         ← key=value (semua string)
  flags: string[];                 // ["primary"]       ← kata bare
  kids: Node[];                    // anak hasil indentasi
}
```

Root parse adalah Node sintetis bertipe `root`. Hasil `parse()` adalah **fungsi murni** (string → pohon), jadi mudah diuji terpisah dari DOM.

## B2. Anatomi file

Semua ada dalam satu `wireframe.html` (tanpa build step), berurutan:

| Bagian | Isi |
| --- | --- |
| `<style>` | Token warna (light/dark), lalu CSS komponen |
| `SAMPLE` | Contoh default di editor |
| `SNIP` | Peta `tipe → baris contoh`, dipakai untuk chip "Komponen" |
| helper | `E()` buat elemen, `sp()` pecah `\|`, `has()` cek flag, `on()` cek `active`, `kids()` render anak, `fld()` bungkus label+kontrol, `bars()` garis placeholder |
| `parse()` | Teks → AST |
| `R` | **Registry renderer**: `tipe → (node) => HTMLElement` |
| `render()` | Panggil renderer + terapkan prop universal `w`, `h`, `flex` |
| wiring | Event editor (`input`, Tab, Enter), tombol Contoh, chip, localStorage |

Alur satu ketikan: `input` → `draw()` → `parse()` → `render()` per node di root → ganti isi `#pv`. Render ulang total setiap ketikan, dan itu cukup cepat untuk ukuran wireframe.

## B3. Menambah komponen baru

Contoh menambah `stepper` (indikator langkah: `stepper "Data|Bayar|Selesai" active=2`).

**1. Renderer di `R`:**

```js
stepper: n => {
  const e = E('div', 'pg');                       // pakai ulang kelas yang ada jika cocok
  sp(n.args[0]).forEach((x, i) =>
    e.append(E('span', 'pgi' + (on(n, i) ? ' act' : ''), (i + 1) + '. ' + x)));
  return e;
},
```

**2. Contoh di `SNIP`** (otomatis jadi chip):

```js
stepper: 'stepper "Data|Bayar|Selesai" active=2',
```

**3. Jika komponen kecil/inline**, tambahkan namanya ke `NOFLEX` supaya tidak melar di dalam `row`.

**4. Jika butuh gaya baru**, tambah CSS di bagian `/* wireframe */`.

**5. Jika container**, panggil `kids(el, n)` di renderer, atau pakai `cont('namakelas')` untuk container polos.

Aturan kecil supaya konsisten:

- Pakai `E(tag, className, text)`. Isi teks lewat `textContent`, jangan `innerHTML`, supaya input pengguna tidak jadi HTML.
- Pakai variabel CSS (`--ln`, `--fl`, `--ink`, `--pn`, `--mu`), jangan warna hard-coded. Itu yang menjaga dark mode dan tampilan low-fi grayscale.
- Renderer tidak boleh melempar error pada input aneh. Beri default (`n.args[0]||'Item'`).

## B4. Tema (dark mode)

Token didefinisikan di **tiga tempat**: `:root` (light), blok `@media (prefers-color-scheme: dark)`, dan `:root[data-theme="dark"]`. Jika menambah token baru, isi ketiganya.

## B5. Batasan lingkungan (halaman ter-publish)

Halaman ini berjalan di sandbox dengan aturan keras:

- **Self-contained.** Tidak ada gambar/skrip/font dari host lain kecuali yang diizinkan, dan request jaringan ke situs lain diblokir diam-diam.
- **`localStorage`** boleh dipakai, tapi selalu bungkus `try/catch` (sudah dilakukan di `draw()` dan inisialisasi).
- Tidak ada `window.storage`, API Claude, dll. Untuk fitur yang butuh state bersama, perlu capability khusus.
- Jika dipindah ke hosting sendiri, semua batasan di atas hilang.

## B6. Utang teknis yang diketahui

| Masalah | Dampak | Perbaikan |
| --- | --- | --- |
| Tidak ada nomor baris di error | Sulit melacak typo | Simpan `line` di Node saat parse |
| Tidak ada validasi prop | `active=abc` jadi 0 diam-diam | Tabel skema per tipe: `{args, props, flags}` |
| `document.execCommand` (Tab/Enter) | Deprecated, tapi paling andal untuk menjaga undo | Ganti `setRangeText` (kehilangan undo) bila suatu saat dihapus browser |
| Tidak ada escape `"` | Teks dengan kutip tidak bisa | Tambah `\"` ke regex tokenizer |
| Tidak ada syntax highlight | Editor polos | Overlay `<pre>` di belakang textarea, atau CodeMirror (tapi harus CDN yang diizinkan) |
| Kunci `localStorage` tunggal (`wf-src`) | Hanya satu dokumen | Prefix per-proyek, daftar di UI |

## B7. Roadmap (dari tujuan akhir mundur)

**Tujuan akhir:** wireframe bisa dibagikan ke tim/klien dan dipahami tanpa penjelasan.

Mundur dari sana, urutan yang masuk akal:

1. **Dibagikan sebagai deliverable** → butuh *export* (PNG/SVG/print-to-PDF) dan *share link*.
2. **Share link tanpa backend** → simpan sumber di URL hash:

   ```js
   location.hash = btoa(unescape(encodeURIComponent(ta.value)));
   // baca: ta.value = decodeURIComponent(escape(atob(location.hash.slice(1))));
   ```

   Sumber teks kecil, jadi cukup tanpa kompresi.
3. **Dipahami sebagai alur** (bukan layar terpisah) → prop `goto="Dashboard"` pada `button`/`link`, lalu render panah antar `screen` (SVG overlay).
4. **Tidak ngulang-ngulang** → komponen reusable: `def nama` + `use nama` (ekspansi di tahap `parse`, sebelum render, jadi `render` tidak berubah).
5. **Bisa diedit dengan nyaman** → nomor baris pada error, syntax highlight, autocomplete dari `Object.keys(R)`.
6. **Tidak rusak saat berkembang** → ekstrak `parse` ke fungsi murni yang bisa diuji di Node:

   ```js
   // parse.test.mjs
   import assert from 'node:assert';
   const t = parse('screen "A" mobile\n  button "Ok" primary');
   assert.equal(t.kids[0].kids[0].flags[0], 'primary');
   ```

Mengerjakan dari nomor 6 ke 1 (fondasi dulu) atau 1 ke 6 (hasil dulu) sama-sama valid. Saran: mulai dari **2 (share link)** karena murah dan langsung terasa gunanya.

## B8. Checklist sebelum menggabungkan perubahan

- [ ] Komponen baru ada di `R` **dan** `SNIP`
- [ ] Input kosong/tidak lengkap tidak error (`wireframe.html` tetap render)
- [ ] Tampil benar di light dan dark mode
- [ ] Tampil benar di dalam `row` (cek `NOFLEX`)
- [ ] Dokumen ini diperbarui (tabel A3)
