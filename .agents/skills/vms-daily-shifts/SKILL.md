---
name: vms-daily-shifts
description: VMS 7 Uzman Ajan kadrosunun (Atlas, Pusula, Mimar, Demir, Yankı, Avcı, Bilge) günlük 4 vardiya standart operasyon prosedürleri (SOP) ve Kaizen gelişim kuralları.
---

# VMS Günlük 4 Vardiya SOP & Alt-Ajan Görev Dağılımı

`/teamwork` veya `/goal` ile uzun süreli otonom mesai başlatıldığında aşağıdaki 4 vardiya sırası takip edilir:

## 1. Sabah Vardiyası (`09:00` — Strateji & Keşif)
- **Pusula (`researcher`):** Türkiye KOBİ dikeylerinde (klinik, güzellik, emlak, restoran, ofis) mesai dışı müşteri kaybı ve randevu iptali darboğazlarını analiz eder.
- **Mimar (`pm`):** TL paket konumlandırmasını ve ücretsiz deneme kancasını günceller.
- **Atlas (`coo`):** CEO direktifini (`ceo_active_directive`) dikkate alarak günlük sprint planını kilitler.

## 2. Öğle Vardiyası (`12:30` — Mühendislik QA & Organik Büyüme)
- **Demir (`builder`):** Tüm `/demo/[slug]` şablonlarını doğrular ve bir sonraki ürün geliştirmesi için `backlog/build-specs/` altına teknik iş emri yazar.
- **Yankı (`growth`):** Hedef KOBİ dikeyi için Türkçe SEO rehberi (`/blog/[slug]`) ve sosyal medya paylaşım metni yayınlar.

## 3. İkindi Vardiyası (`16:00` — Lead Avı, Canlı Demo & Satış)
- **Avcı (`sales`):** Yüksek puanlı KOBİ işletmelerini belirler, her işletmenin kendi adıyla çalışan `/demo/[slug]` canlı önizlemesini oluşturur, A ve B varyantlı Türkçe WhatsApp davet mesajlarını CEO onay kuyruğuna (`approval_queue`) sunar.

## 4. Gece Vardiyası (`22:00` — Kaizen Öz-Evrim)
- **Bilge (`kaizen`):** Demo açılma, AI sohbet ve randevu simülasyonu metriklerini ölçer; kazanan A/B kancasını `agent_playbooks` tablosuna yeni sürüm (`v+1`) olarak işler.
