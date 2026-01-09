# Laporan Analisis Optimasi Basis Data: Studi Kasus StatusShare

## 1. Pemilihan Teknologi Basis Data

### Kombinasi Teknologi

Untuk aplikasi "StatusShare" dengan karakteristik read-heavy (timeline) dan kebutuhan relasional yang kuat (follow/unfollow), saya merekomendasikan arsitektur **Hybrid**:

1.  **Primary Database: PostgreSQL (SQL)**
2.  **Caching & High-Speed Counter: Redis (NoSQL Key-Value)**

### Alasan Pemilihan (SQL vs NoSQL)

- **Kenapa PostgreSQL (SQL)?**

  - **Integritas Data Relasional**: Data sosial sangat bergantung pada relasi (User _follows_ User, User _likes_ Post). SQL sangat efisien untuk menjaga integritas ini (Foreign Keys) dibandingkan MongoDB.
  - **Struktur Tetap**: Data User dan Post memiliki struktur yang konsisten, cocok untuk skema tabel SQL.
  - **Kompleksitas Query**: PostgreSQL sangat powerful untuk query analitik kompleks jika kelak dibutuhkan.

- **Kenapa Redis?**

  - **Timeline Feed Speed**: Query timeline (`SELECT * FROM posts WHERE user_id IN ...`) adalah query yang berat jika hanya mengandalkan SQL saat user bertambah. Redis digunakan untuk menyimpan _pre-computed timeline_ (User Timeline Cache).
  - **Real-time Counters**: "Like" adalah operasi write-heavy. Menulis langsung ke disk (SQL) setiap kali user melakukan like pada post selebriti akan membebani I/O. Redis `INCR` beroperasi di memori (nanosecond latency).

- **Kenapa Tidak MongoDB?**
  - MongoDB ("Document Store") bagus jika struktur post sangat bervariasi. Namun, kelemahan utamanya pada kasus ini adalah **Join** (Lookup). Mengambil timeline dari 500 orang yang difollow memerlukan operasi agregasi yang lebih mahal resource-nya dibandingkan Join SQL yang sudah teroptimasi, atau sekalian menggunakan Redis List.

## 2. Model Data

### Diagram ER (Logical Structure)

**Tabel: Users**

- `id` (PK, BigInt/UUID)
- `username` (Varchar, Unique, Indexed)
- `bio` (Text)
- `profile_picture_url` (Varchar)
- `created_at` (Timestamp)

**Tabel: Posts**

- `id` (PK, BigInt)
- `user_id` (FK -> Users.id, Indexed)
- `content` (Text)
- `image_url` (Varchar)
- `created_at` (Timestamp, Indexed for ordering)
- `likes_count_cached` (Int - _Denormalisasi untuk performa read_)

**Tabel: Follows**

- `follower_id` (FK -> Users.id)
- `following_id` (FK -> Users.id)
- _Primary Key Composite: (follower_id, following_id)_
- _Index: (following_id) untuk query "Who follows me"_

**Tabel: Likes**

- `id` (PK)
- `post_id` (FK -> Posts.id)
- `user_id` (FK -> Users.id)
- `created_at` (Timestamp)
- _Unique Constraint: (post_id, user_id) untuk mencegah double like_

**Tabel: Comments**

- `id` (PK)
- `post_id` (FK -> Posts.id, Indexed)
- `user_id` (FK -> Users.id)
- `text` (Text)
- `created_at` (Timestamp)

## 3. Implementasi 7 Operasi Utama

### 1. Get Timeline Feed (Optimasi)

Mengambil post dari user yang difollow.

- **Naive SQL**:
  ```sql
  SELECT p.*, u.username, u.profile_picture_url
  FROM posts p
  JOIN users u ON p.user_id = u.id
  WHERE p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
  ORDER BY p.created_at DESC
  LIMIT 20 OFFSET 0;
  ```
- **Optimasi**: Index pada `follows(follower_id)` dan `posts(user_id, created_at)` sangat krusial.

### 2. Follow User

- **Query**:
  ```sql
  INSERT INTO follows (follower_id, following_id) VALUES (?, ?);
  ```
- **Logic Tambahan**: Jika menggunakan Caching, sistem harus meng-invalidate cache timeline follower atau menyuntikkan post lama following ke timeline.

### 3. Unfollow User

- **Query**:
  ```sql
  DELETE FROM follows WHERE follower_id = ? AND following_id = ?;
  ```

### 4. Like Post (Real-time Handling)

- **Command**:
  1.  Tulis ke SQL untuk persistensi: `INSERT INTO likes (post_id, user_id) ...`
  2.  Update counter cepat di Redis: `INCR post:likes:{id}`
  3.  Secara berkala (async) update field `likes_count_cached` di tabel Posts SQL agar sinkron.

### 5. Add Comment

- **Query**:
  ```sql
  INSERT INTO comments (post_id, user_id, text, created_at) VALUES (?, ?, ?, NOW());
  ```

### 6. Get Comments (Pagination)

- **Query**:
  ```sql
  SELECT c.*, u.username
  FROM comments c
  JOIN users u ON c.user_id = u.id
  WHERE c.post_id = ?
  ORDER BY c.created_at ASC
  LIMIT 20 OFFSET ?;
  ```
- **Index**: Perlu Composite Index pada `comments(post_id, created_at)`.

### 7. Get User Profile (With Stats)

- **Query**:
  ```sql
  SELECT u.*,
     (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as total_posts,
     (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers,
     (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following
  FROM users u
  WHERE u.id = ?;
  ```
- **Optimasi**: Bagian count ini berat. Sebaiknya angka-angka ini disimpan di kolom `user` dan diupdate via trigger/event, atau dicache di Redis `user:stats:{id}`.

## 4. Strategi Optimasi Lanjutan

### Caching Strategy: Timeline Feed

Untuk kasus **Scalability** ke 100K user atau lebih, query `WHERE IN (...)` akan melambat.
Strategi **"Fan-out on Write" (Push Model)**:

1.  Saat User A memposting sesuatu.
2.  Sistem mencari semua _Followers_ aktif dari User A.
3.  Sistem memasukkan ID Post tersebut ke dalam Redis List masing-masing follower (`LPUSH timeline:{follower_id} post_id`).
4.  Saat Follower membuka beranda, mereka hanya membaca dari Redis List mereka (O(1)), bukan melakukan query SQL yang berat.

### Handling Celebrity Post (5000 likes/menit)

Masalah: "Thundering Herd" atau "Hot Row Contention" di Database jika setiap like melakukan `UPDATE posts SET likes = likes + 1`. Database akan lock baris tersebut.
**Solusi**:

1.  **Buffer di Redis**: Terima semua like di Redis terlebih dahulu (`INCR`). Redis single-threaded tapi in-memory, sangat cepat menangani ribuan ops/detik.
2.  **Batch Write**: Worker di background mengambil jumlah like dari Redis setiap beberapa detik (misal setiap 5 detik) dan melakukan update ke SQL sekali saja: `UPDATE posts SET likes_count_cached = likes_count_cached + 500 WHERE id = ?`.

### Indexing Summary

1.  `users(username)` -> Login & Search.
2.  `follows(follower_id, following_id)` -> Relasi.
3.  `posts(user_id, created_at DESC)` -> Mengambil post profil & feed.
4.  `comments(post_id)` -> Mengambil komentar.
