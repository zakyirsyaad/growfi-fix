# Antigravity Code Review - GrowFi UI Changes

Tanggal review: 2026-06-04

Scope review: perubahan working tree saat ini terhadap `main`, terutama redesign UI/layout, marketplace, wallet, inventory, dan Tailwind theme.

## Ringkasan Verifikasi

| Check | Hasil | Catatan |
| --- | --- | --- |
| `git diff --check` | Gagal | Banyak trailing whitespace di `app/page.tsx`, `components/inventory/InventoryCards.tsx`, `components/marketplace/MarketplaceDashboard.tsx`, dan `components/wallet/WalletDashboard.tsx`. |
| `pnpm lint` | Lolos dengan warning | Warning `@next/next/no-img-element` di `components/layout/Navbar.tsx:40`. |
| `pnpm typecheck` | Lolos | `next typegen && tsc --noEmit` sukses. |
| `pnpm build` | Lolos dengan warning | Build sukses. Ada warning `<img>` yang sama dan beberapa `bigint: Failed to load bindings`. |
| Browser smoke test | Lolos basic render | `/`, `/marketplace`, `/game`, `/play` tidak menampilkan framework error overlay atau console error. Namun beberapa regresi UI/fitur terlihat dari DOM dan kode. |

## Harus Diperbaiki / Dicode Lagi

### 1. P0 - Flow membuat marketplace listing hilang

**Bukti:**

- `components/marketplace/MarketplaceDashboard.tsx:24-212` sekarang hanya punya browse, buy, dan cancel. Flow create listing yang sebelumnya ada di dashboard dihapus.
- `app/api/marketplace/list/route.ts:7-12` masih menyediakan endpoint create listing, jadi backend capability masih ada.
- `app/inventory/page.tsx:121-127` memanggil `<FruitCards>` hanya dengan `onSell`, tanpa `onList`.
- `components/inventory/InventoryCards.tsx:64-73` masih punya prop `onList`, tetapi tidak ada caller aktif. `rg "onList=|<FruitCards"` hanya menemukan pemakaian di `app/inventory/page.tsx`.

**Dampak:**

User tidak punya jalur UI untuk membuat listing baru. Marketplace berubah menjadi read/buy/cancel only, padahal API dan komponen masih mengindikasikan fitur listing harus ada.

**Yang perlu dicode:**

- Restore tab/form `Create Listing` di marketplace, atau pindahkan flow ke Inventory dengan tombol `List`.
- Form harus tetap mendukung `quantity`, `price`, validasi available fruit, dan mode on-chain/off-chain seperti implementasi sebelumnya.
- Setelah create listing sukses, invalidate query `marketplace`, `inventory`, `growfi-onchain-marketplace`, dan `growfi-onchain-state`.
- Tambahkan smoke test manual atau Playwright untuk alur: inventory fruit available -> create listing -> listing muncul di marketplace.

### 2. P0 - Tailwind theme migration belum selesai dan memutus banyak class lama

**Bukti:**

- `tailwind.config.ts:14-72` mengganti token warna ke OKLCH dan menghapus palette lama `leaf`, `soil`, `gold`, `berry`, dan `skyday`.
- Masih ada banyak class lama di file aktif, misalnya:
  - `components/shop/ShopItemCard.tsx:42-51`
  - `components/marketplace/ListingCard.tsx:45-57`
  - `components/layout/AuthGate.tsx:12-20`
  - `components/garden/GardenGrid.tsx:30-33`
  - `components/game/GameCanvas.tsx:32`
- `components/wallet/WalletDashboard.tsx:190-354` memakai class baru yang tidak didefinisikan, seperti `bg-surface-variant`, `text-warning`, dan `font-body-sm`.

**Dampak:**

Tailwind tidak akan generate CSS untuk custom class yang sudah tidak ada. Banyak bagian game, auth gate, shop, garden, listing cards, dan wallet akan kehilangan warna/background/state styling.

**Yang perlu dicode:**

- Pilih salah satu:
  - kembalikan palette lama di `tailwind.config.ts`, atau
  - migrasikan semua pemakaian `leaf-*`, `soil-*`, `gold-*`, `berry-*`, dan `skyday-*` ke token baru.
- Tambahkan token yang dipakai wallet tapi belum ada (`surface-variant`, `warning`, `font-body-sm`) atau ganti ke token yang memang tersedia.
- Jalankan `rg -n "\\b(leaf|soil|gold|berry|skyday)-|surface-variant|warning|font-body-sm" app components` sampai hasilnya nol atau setiap token memang ada di config.

### 3. P1 - Wallet dashboard kehilangan kontrol penting dan menambah data palsu

**Bukti:**

- `components/wallet/WalletDashboard.tsx:209-215` mengganti deposit/withdraw menjadi tombol fixed `Deposit 10` dan `Withdraw 10`.
- Amount input lama untuk deposit/withdraw hilang dari UI, walaupun state `depositAmount` dan `withdrawAmount` masih ada di `components/wallet/WalletDashboard.tsx:57-58`.
- `components/wallet/WalletDashboard.tsx:222-249` menampilkan `Staking Rewards`, `APY 12.4%`, dan tombol `Manage Staking`, tetapi tidak ada implementasi staking.
- `components/wallet/WalletDashboard.tsx:170` memakai estimasi USD hardcoded `growValueNum * 1.42`.
- `components/game/overlays/WalletOverlay.tsx:14-15` menghapus mode `compact`, sehingga overlay game sekarang memuat dashboard wallet penuh termasuk tabel transaksi.

**Dampak:**

Wallet menjadi kurang usable untuk amount selain 10, menampilkan fitur staking yang belum ada, dan membawa data finansial palsu. Overlay game juga berisiko terlalu besar/berat untuk panel in-game.

**Yang perlu dicode:**

- Restore input amount untuk deposit dan withdraw.
- Kembalikan status program/token mint/treasury/devnet mint alert, atau pindahkan ke section baru yang tetap terlihat.
- Hapus staking UI sampai backend/on-chain staking benar-benar ada, atau implementasikan endpoint/program flow yang valid.
- Jangan tampilkan USD estimate kecuali ada oracle/price source yang jelas. Kalau hanya placeholder, labeli sebagai dev/mock.
- Restore `compact` support di `WalletDashboard` untuk `WalletOverlay`, atau buat komponen wallet summary khusus overlay.

### 4. P1 - Navigasi utama kehilangan route penting dan sign out

**Bukti:**

- `components/layout/AppShell.tsx:31-38` mengganti sidebar lama dengan navbar/footer global.
- `components/layout/Navbar.tsx:23-32` hanya menyediakan link `Marketplace`, `Wallet`, dan `Leaderboard`.
- Route penting seperti `/game`, `/shop`, `/inventory`, `/trade`, dan `/profile` tidak ada di navbar.
- `components/layout/Navbar.tsx:36-47` menampilkan user dan wallet button saat authenticated, tetapi tidak ada `signOut`.

**Dampak:**

User yang sudah login tidak punya navigasi langsung ke core gameplay/economy pages dan tidak punya tombol logout. Ini regresi dari sidebar lama yang punya grup Play, Economy, dan Social.

**Yang perlu dicode:**

- Tambahkan kembali semua route utama, minimal: Home, Game, Shop, Marketplace, Inventory, Trade, Wallet, Leaderboard, Profile.
- Tambahkan menu user atau dropdown yang punya `Sign out`.
- Untuk mobile, tambahkan menu collapse/drawer. Navbar sekarang menyembunyikan link tengah di mobile dan hanya menyisakan brand + login/wallet.
- Pastikan active state route terlihat.

### 5. P1 - Marketplace filter/search dan landing metrics masih dummy

**Bukti:**

- `app/marketplace/page.tsx:17-50` menambahkan checkbox filter kategori/rarity, tetapi checkbox tidak terhubung ke state/query/listing filter.
- `components/marketplace/MarketplaceDashboard.tsx:108-110` menampilkan search input, tetapi tidak ada state atau filtering.
- `components/marketplace/MarketplaceDashboard.tsx:120-134` menampilkan `Total Volume 1.2M` dan `Floor Price 42 $GROW` secara hardcoded.
- `app/page.tsx:60-69` menampilkan `Total Volume $12.4M`, `Active Farmers 8,420`, dan `Items Traded 1.2M+` hardcoded.
- `components/layout/Footer.tsx:25-31` memakai `href="#"` untuk Docs, Terms, dan Privacy.

**Dampak:**

UI memberikan sinyal fitur/data production yang belum benar. User bisa mengklik filter/search tetapi tidak ada hasil yang berubah. Landing page juga mengklaim metrik tanpa sumber data.

**Yang perlu dicode:**

- Wire search dan filter ke `marketplaceData.listings` atau query API.
- Ganti stat hardcoded dengan data nyata dari API, atau labeli sebagai dev/demo dan jangan tampilkan sebagai production metric.
- Ganti footer `href="#"` ke route/dokumen nyata, atau hapus link sampai halaman tersedia.

### 6. P2 - Material Symbols dipakai tanpa font/icon loader

**Bukti:**

- `components/wallet/WalletDashboard.tsx:198`, `210`, `214`, `305`, `324`, `326`, `328`, dan `351` memakai `<span className="material-symbols-outlined">...`.
- `app/layout.tsx:5-18` hanya load `Inter` dan `Geist_Mono`. Tidak ada import Material Symbols.
- Project sudah memakai `lucide-react`, dan navbar/landing memakai lucide icons.

**Dampak:**

Icon wallet/transaction bisa tampil sebagai teks literal seperti `account_balance_wallet`, `south_west`, atau `receipt_long` kalau font Material Symbols tidak tersedia.

**Yang perlu dicode:**

- Ganti semua Material Symbols di wallet ke icon `lucide-react`, atau load font Material Symbols secara eksplisit.
- Lebih konsisten memakai lucide karena dependency sudah ada dan dipakai di komponen lain.

### 7. P2 - Kualitas perubahan masih perlu cleanup sebelum merge

**Bukti:**

- `git diff --check` gagal karena trailing whitespace di banyak file yang diubah.
- `components/layout/Navbar.tsx:40` memakai `<img>` dan memicu warning `@next/next/no-img-element`.
- `components/wallet/WalletDashboard.tsx:253-254` punya komentar duplikat `Transaction History Table`.
- `app/globals.css` tidak punya newline di akhir file.

**Dampak:**

Ini bukan blocker produk utama, tetapi akan mengganggu gate CI/commit hygiene dan membuat diff terlihat generated/kurang dirapikan.

**Yang perlu dicode:**

- Bersihkan trailing whitespace dan newline EOF.
- Ganti avatar `<img>` ke `next/image` atau komponen avatar yang sudah ada.
- Hapus komentar duplikat dan komentar placeholder yang tidak menambah konteks.

## Urutan Perbaikan yang Disarankan

1. Perbaiki Tailwind token migration atau revert sebagian theme agar semua permukaan lama kembali styled.
2. Restore/create ulang flow `Create Listing` marketplace.
3. Restore wallet amount input, hapus staking/mock price palsu, dan kembalikan compact overlay.
4. Lengkapi navbar/mobile nav/sign out untuk semua route utama.
5. Wire marketplace search/filter dan hapus metrik/link dummy.
6. Cleanup whitespace, icon/font, dan warning lint.

## Verifikasi Setelah Perbaikan

Jalankan minimal:

```bash
git diff --check
pnpm lint
pnpm typecheck
pnpm build
```

Lalu smoke test browser:

- `/` landing page render tanpa data palsu atau label demo jelas.
- `/marketplace` setelah login: search/filter bekerja, buy/cancel bekerja, create listing tersedia.
- `/inventory` setelah login: sell fruit bekerja dan flow list fruit tersedia kalau dipindah ke inventory.
- `/wallet` setelah login + wallet connect: deposit/withdraw amount bebas, mint/status tetap jelas.
- `/game`: wallet overlay tetap compact dan tidak memuat dashboard penuh yang merusak panel game.
