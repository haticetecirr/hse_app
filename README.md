# ISG Bildirim Sistemi — İş Kazası & Ramak Kala

Bir fabrikanın tüm **iş kazası** ve **ramak kala** bildirimleri için geliştirilmiş,
rol/yetki tabanlı (RBAC) web uygulaması.

- **backend/** — NestJS + Prisma + PostgreSQL (REST API)
- **client/** — React + Vite + TypeScript (SPA, TR/EN i18n)
- **docker-compose.yml** — Local PostgreSQL (DB yönetimi için kendi pgAdmin'inizi kullanın)

---

## Özellikler

| # | Özellik |
|---|---------|
| 1 | İki ayrı proje: **backend** ve **client** |
| 2 | Docker içinde local **PostgreSQL** |
| 3 | Önceden tanımlı **süper admin** hesabı (ilk seed'de oluşur) |
| 4 | **Register** ile hesap açma → `status: PENDING` → admin onayı ile `VERIFIED` |
| 5 | Admin: onaylama, **rol / rütbe / birim** atama (yetki genişliği rütbe & role göre artar) |
| 6 | Yetki (role verification) alanlara **bildirim** gönderme (uygulama içi notification) |
| 7 | **İş kazası** bildirimi: kaza türü + tıklanabilir **SVG insan vücudu haritası** ile yaralanma noktası/türü/ciddiyeti |
| 8 | **Ramak kala** bildirimi: sektör/global standartlara uygun — tehlike sınıfı, **5×5 risk matrisi**, kök neden, düzeltici faaliyet (CAPA) |

> Not: Klavye yazma eğitimi modülü bu sürümde kapsam dışıdır.

---

## Gereksinimler

- **Node.js** 18+ (20 önerilir)
- **Docker Desktop** (local PostgreSQL için)

---

## Hızlı Başlangıç

### 1) PostgreSQL'i Docker ile başlat

Proje kök dizininde:

```bash
docker compose up -d
```

Bu; **PostgreSQL** (host portu **5433**), **pgAdmin** (web) ve **MinIO** (nesne depolama) başlatır.

**MinIO (yüklenen foto/videolar burada saklanır)**
- S3 API: `localhost:9000` — Web konsol: **http://localhost:9001**
- Giriş: `hse_minio` / `hse_minio_password`
- Bucket `hse-uploads` backend ilk açılışta otomatik oluşturulur.


**pgAdmin (web) — http://localhost:5050**
- Giriş: `admin@hse.com` / `admin`
- DB bağlantısı **önceden tanımlıdır** (`HSE Docker`). İlk açılışta sunucuyu genişletince
  bir kez DB şifresini ister: `hse_password`.

> Docker ağı içinde pgAdmin, PostgreSQL'e `postgres:5432` üzerinden bağlanır (host portu 5433 değil).

Kendi masaüstü pgAdmin'inizi kullanmak isterseniz de bağlanabilirsiniz:

```
Host: localhost   Port: 5433
DB:   hse_db       User: hse    Şifre: hse_password
```

### 2) Backend

```bash
cd backend
cp .env.example .env          # Windows PowerShell: copy .env.example .env
npm install
npm run prisma:generate       # Prisma client üret
npm run prisma:migrate        # Şemayı DB'ye uygula (migration oluşturur)
npm run prisma:seed           # Süper admin + roller + birimler
npm run start:dev             # http://localhost:3000/api
```

> `prisma:migrate` ilk çalıştırmada migration adı ister (örn: `init`).
> Migration yerine hızlı kurulum için: `npx prisma db push && npm run prisma:seed`

### 3) Client

Yeni bir terminalde:

```bash
cd client
npm install
npm run dev                   # http://localhost:5173
```

Vite, `/api` isteklerini otomatik olarak backend'e (`localhost:3000`) yönlendirir.

---

## Varsayılan Süper Admin

`.env` dosyasındaki değerlerle seed edilir (varsayılan):

```
E-posta : admin@hse.local
Şifre   : Admin123!
```

Login ekranından bu bilgilerle giriş yapabilirsiniz.

---

## Tipik Akış

1. Yeni bir kullanıcı **Register** olur → hesap `PENDING`, giriş yapsa da bildirim yapamaz.
2. Süper admin (veya `USER_APPROVE` yetkili biri) **Yönetim → Kullanıcılar** ekranından
   kullanıcıyı **onaylar**, aynı ekranda **rol / rütbe / birim** atar.
3. Onaylanan kullanıcıya "hesabınız onaylandı" bildirimi düşer.
4. Kullanıcı, rolündeki izinlere göre **İş Kazası** veya **Ramak Kala** bildirimi oluşturur.
5. Yeni bildirim, `REPORT_VIEW_ALL` yetkili kişilere (ör. İSG Uzmanı) bildirim olarak iletilir.
6. İSG Uzmanı bildirimi inceler, birine atar, düzeltici faaliyet ekler, durumu günceller/kapatır.

---

## Varsayılan Roller (seed)

| Rol | Öne çıkan izinler |
|-----|-------------------|
| **Çalışan** | Kaza & ramak kala oluşturma, kendi bildirimlerini görme |
| **Birim Sorumlusu** | + birim bildirimlerini görme, atama, faaliyet yönetimi |
| **İSG Uzmanı** | + tüm bildirimleri görme, soruşturma, kapatma, bildirim gönderme |
| **Yönetici** | Kullanıcı onayı, rol/rütbe/birim yönetimi, duyuru |

Roller ve izinler **Yönetim → Roller** ekranından tamamen düzenlenebilir.

---

## Mimarinin Özeti

### Yetkilendirme (RBAC)
- `Permission` enum'u granüler izinleri tanımlar (örn. `REPORT_CREATE_ACCIDENT`, `USER_APPROVE`).
- `Role` bir izin listesi taşır; kullanıcıya rol atanır.
- `Rank` (rütbe) bilgilendirme + sıralama amaçlıdır.
- Süper admin tüm izinlere sahiptir.
- Backend'de global `JwtAuthGuard` + `PermissionsGuard` uçları korur.

### Ramak Kala — 5×5 Risk Matrisi
`riskScore = severity × likelihood` → `LOW (≤4) / MEDIUM (≤9) / HIGH (≤15) / CRITICAL (>15)`.
Aynı mantık hem client (canlı önizleme) hem backend'de uygulanır.

### İş Kazası — Vücut Haritası
Ön/arka SVG insan figürü üzerinde bölgeye tıklanır, yaralanma türü ve ciddiyeti seçilir;
her yaralanma `bodyPart + side + view + type + severity` olarak kaydedilir.

---

## Faydalı Komutlar

```bash
# Backend
npm run prisma:migrate      # yeni migration
npx prisma studio           # DB'yi görsel incele
npm run build && npm start  # production

# Client
npm run build               # production build (dist/)
npm run preview             # build önizleme
```

## Ortam Değişkenleri (backend/.env)

| Değişken | Açıklama |
|----------|----------|
| `DATABASE_URL` | PostgreSQL bağlantısı |
| `JWT_SECRET` | Token imzalama anahtarı (prod'da değiştirin) |
| `PORT` | Backend portu (3000) |
| `CORS_ORIGIN` | İzin verilen client origin (5173) |
| `SUPER_ADMIN_EMAIL / _PASSWORD / _NAME` | Seed süper admin bilgileri |
