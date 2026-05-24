# Parlaq Call Center

## Kurulum

```bash
# Backend
cd backend
npm install
copy .env.example .env
# .env dosyasına NETGSM_PASSWORD ve DATABASE_URL gir

# Veritabanı (PostgreSQL çalışıyor olmalı)
psql -U postgres -c "CREATE DATABASE parlaq_callcenter;"
psql -U postgres -d parlaq_callcenter -f src/db/schema.sql

npm run dev   # http://localhost:3001

# Frontend (ayrı terminal)
cd frontend
npm install
npm run dev   # http://localhost:5173
```

## .env Değişkenleri

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` | PostgreSQL bağlantı URL'i |
| `NETGSM_PASSWORD` | Netsantral API şifresi |
| `NETGSM_USERNAME` | Santral numarası (8503088214) |

## Faz 1 — Tamamlandı

- Backend API (Express + PostgreSQL)
- Netgsm HTTP GET entegrasyonu
- Netsantral TCP socket (gerçek zamanlı)
- Dashboard: İstatistik kartları, çalışan grid, canlı çağrı paneli
- Çağrı sayfası: Arama, sessize alma, transfer, geçmiş
- Çalışan sayfası: CRUD, giriş/çıkış, mola yönetimi
- Raporlar: CDR tablosu, istatistikler
