---
name: vms-orchestrator
description: VMS Otonom Yazılım Ajansının COO (Atlas) orkestrasyon yeteneği. Kullanıcı uzaktan vardiya çalıştırmak, yeni KOBİ demosu hazırlamak, onay kuyruğunu yönetmek, Kaizen öz-gelişim döngüsünü işletmek veya BuildSpec geliştirmelerini kodlamak istediğinde kullanılır.
---

# VMS Otonom Yazılım Ajansı — Orkestratör (COO Atlas) Kılavuzu

Bu yetenek, `/home/antigravity/ABYdevprog/VMS` deposundaki 7 uzman ajanlı otonom yazılım ajansını doğrudan Antigravity içinden (harici API anahtarı gerektirmeden, mevcut abonelikle) yönetir.

## Temel Komutlar (`Cwd: /home/antigravity/ABYdevprog/VMS`)

1. **Ajans Anlık Durum Özeti:**
   ```bash
   npm run vms -- status
   ```
2. **Kaçırılmış Vardiyaları Otomatik Telafi Et (VM Uyandığında İlk Adım):**
   ```bash
   npm run vms -- shift:catchup
   ```
3. **Belirli Bir Vardiyayı veya Tam Günü Çalıştır:**
   ```bash
   npm run vms -- shift:run morning     # 09:00 Pusula + Mimar + Atlas
   npm run vms -- shift:run midday      # 12:30 Demir + Yankı (QA, BuildSpec, SEO)
   npm run vms -- shift:run afternoon   # 16:00 Avcı (KOBİ Lead + Canlı /demo/[slug] + Satış Mesajı)
   npm run vms -- shift:run night       # 22:00 Bilge (Kaizen Telemetri Analizi & Playbook v+1)
   npm run vms -- shift:run all         # Tüm 4 vardiyayı sırayla çalıştır
   ```
4. **CEO Stratejik Talimatını Kaydet:**
   ```bash
   npm run vms -- directive "Yarın Ankara Çankaya emlak ofislerine odaklanın"
   ```
5. **Bekleyen Onay Kuyruğunu Onayla:**
   ```bash
   npm run vms -- approve:all
   ```

## Ağır Mühendislik & Yeni Özellik Döngüsü

1. `backlog/build-specs/` dizinindeki en güncel `.md` iş emrini oku.
2. İstenen yeni SaaS modülünü veya demo özelliğini `src/` altında kodla.
3. `npm test` ve `npm run build` ile doğrula, ardından GitHub'a (`ABYdevprog/VMS`) commit/push yaparak halka açık canlı demoları güncelle.
