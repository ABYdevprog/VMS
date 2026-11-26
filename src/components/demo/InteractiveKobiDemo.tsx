'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, MessageSquare, Send, ShieldCheck } from 'lucide-react';

interface ServiceItem {
  name: string;
  duration: string;
  priceRange: string;
}

interface AppointmentRow {
  id: string;
  customerName: string;
  service: string;
  slot: string;
  source: string;
  status: string;
}

export interface InteractiveDemoProps {
  slug: string;
  businessName: string;
  headline: string;
  subheadline: string;
  city: string;
  accentColor: string;
  assistantName: string;
  welcomeMessage: string;
  services: ServiceItem[];
  starterPriceTry: number;
  proPriceTry: number;
  enterpriseSetupTry: number;
}

export default function InteractiveKobiDemo(props: InteractiveDemoProps) {
  const [messages, setMessages] = useState<Array<{ from: 'bot' | 'user'; text: string; time: string }>>([
    { from: 'bot', text: props.welcomeMessage, time: 'Şimdi' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const [appointments, setAppointments] = useState<AppointmentRow[]>([
    {
      id: 'APT-01',
      customerName: 'Ayşe Yılmaz',
      service: props.services[0]?.name || 'Ön Görüşme',
      slot: 'Bugün 16:00',
      source: 'WhatsApp AI (Otomatik)',
      status: 'Teyitli',
    },
    {
      id: 'APT-02',
      customerName: 'Mehmet Demir',
      service: props.services[1]?.name || 'Danışmanlık',
      slot: 'Yarın 11:30',
      source: 'Instagram DM AI',
      status: 'Hatırlatma Gönderildi',
    },
  ]);

  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro' | 'enterprise_b2b' | null>(null);
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutProvider, setCheckoutProvider] = useState<'paytr' | 'iyzico' | 'shopier' | 'b2b_invoice'>('paytr');
  const [checkoutResult, setCheckoutResult] = useState<string | null>(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  useEffect(() => {
    void fetch('/api/demo/interact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'VIEW', slug: props.slug }),
    });
  }, [props.slug]);

  async function sendChat(messageText: string) {
    const clean = messageText.trim();
    if (!clean || sending) return;

    const nowTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { from: 'user', text: clean, time: nowTime }]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/demo/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CHAT',
          slug: props.slug,
          message: clean,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        reply?: string;
        bookedAppointment?: { customerName: string; service: string; slot: string } | null;
      };

      if (data.ok && data.reply) {
        setMessages((prev) => [...prev, { from: 'bot', text: data.reply!, time: nowTime }]);
        if (data.bookedAppointment) {
          setAppointments((prev) => [
            {
              id: `APT-${prev.length + 1}`,
              customerName: data.bookedAppointment!.customerName,
              service: data.bookedAppointment!.service,
              slot: data.bookedAppointment!.slot,
              source: 'Canlı Demo Testi (Şimdi)',
              status: 'Yeni Oluşturuldu',
            },
            ...prev,
          ]);
        }
      }
    } finally {
      setSending(false);
    }
  }

  async function submitCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlan || submittingOrder) return;
    setSubmittingOrder(true);
    try {
      const res = await fetch('/api/demo/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CHECKOUT',
          slug: props.slug,
          businessName: props.businessName,
          contactPhone: checkoutPhone || '+905000000000',
          planTier: selectedPlan,
          paymentProvider: selectedPlan === 'enterprise_b2b' ? 'b2b_invoice' : checkoutProvider,
        }),
      });
      const data = (await res.json()) as { ok: boolean; checkout?: { paymentInstructions: string } };
      if (data.ok && data.checkout) {
        setCheckoutResult(data.checkout.paymentInstructions);
      }
    } finally {
      setSubmittingOrder(false);
    }
  }

  return (
    <div>
      <section className="hero-section" style={{ paddingTop: '36px', paddingBottom: '36px' }}>
        <div className="shell-container">
          <span className="eyebrow-label" style={{ color: props.accentColor }}>
            {props.city} • İşletmenize Özel Canlı Simülasyon
          </span>
          <h1 className="hero-title" style={{ fontSize: 'clamp(1.7rem, 3.1vw, 2.45rem)', marginBottom: '12px' }}>
            {props.headline}
          </h1>
          <p className="hero-lead" style={{ marginBottom: '0' }}>
            {props.subheadline} Aşağıdaki WhatsApp penceresine <strong>kendi müşterinizmiş gibi</strong> yazarak
            asistanın yanıt hızını ve sağdaki tabloya otomatik randevu düşürmesini canlı test edin.
          </p>
        </div>
      </section>

      <section className="section-block">
        <div className="shell-container">
          <div className="grid-2" style={{ alignItems: 'start' }}>
            {/* Left: Live WhatsApp Simulator */}
            <div className="wa-frame" id="demo-whatsapp-simulator">
              <div className="wa-top" style={{ background: props.accentColor }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.96rem' }}>{props.assistantName}</div>
                  <div style={{ fontSize: '0.77rem', opacity: 0.9 }}>Çevrimiçi • Ortalama yanıt süresi: 3 saniye</div>
                </div>
                <MessageSquare size={20} />
              </div>

              <div className="wa-messages">
                {messages.map((m, idx) => (
                  <div key={idx} className={`wa-bubble ${m.from === 'bot' ? 'wa-bubble-bot' : 'wa-bubble-user'}`}>
                    <div>{m.text}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', textAlign: 'right', marginTop: '4px' }}>
                      {m.time}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="wa-bubble wa-bubble-bot" style={{ color: 'var(--ink-muted)' }}>
                    Yazıyor...
                  </div>
                )}
              </div>

              <div className="wa-quick-prompts">
                <button
                  type="button"
                  id="quick-prompt-price"
                  className="wa-chip"
                  onClick={() => void sendChat('Merhaba, güncel işlem ve hizmet fiyatlarınız nedir?')}
                >
                  💰 Fiyatları Sor
                </button>
                <button
                  type="button"
                  id="quick-prompt-book"
                  className="wa-chip"
                  onClick={() => void sendChat(`Yarın öğleden sonra ${props.services[0]?.name || 'muayene'} için randevu alabilir miyim?`)}
                >
                  📅 Yarın İçin Randevu Al
                </button>
                <button
                  type="button"
                  id="quick-prompt-weekend"
                  className="wa-chip"
                  onClick={() => void sendChat('Cumartesi günü açık mısınız, taksit var mı?')}
                >
                  🕒 Cumartesi & Taksit Sor
                </button>
              </div>

              <form
                className="wa-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendChat(input);
                }}
              >
                <input
                  id="demo-chat-input"
                  className="input-control"
                  placeholder="Müşteriniz gibi bir soru veya randevu talebi yazın..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <button id="demo-chat-send-btn" type="submit" className="btn btn-primary" disabled={sending}>
                  <Send size={16} />
                  Gönder
                </button>
              </form>
            </div>

            {/* Right: Synchronized Business Dashboard Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="surface-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ fontSize: '1.15rem' }}>Canlı Randevu & Müşteri Takip Ekranı</h2>
                    <p style={{ fontSize: '0.84rem', color: 'var(--ink-secondary)' }}>
                      Soldaki sohbette randevu istediğiniz an bu listeye otomatik düşer.
                    </p>
                  </div>
                  <span className="tag tag-emerald">
                    <Calendar size={13} /> Canlı Senkronize
                  </span>
                </div>

                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Müşteri</th>
                        <th>Hizmet</th>
                        <th>Tarih / Saat</th>
                        <th>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.map((apt) => (
                        <tr key={apt.id}>
                          <td style={{ fontWeight: 600 }}>{apt.customerName}</td>
                          <td>{apt.service}</td>
                          <td className="tabular">{apt.slot}</td>
                          <td>
                            <span className={apt.source.includes('Şimdi') ? 'tag tag-emerald' : 'tag tag-neutral'}>
                              {apt.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="surface-card">
                <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>
                  {props.businessName} İçin Tanımlanan Hizmet Bilgileri
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {props.services.map((srv, idx) => (
                    <div
                      key={idx}
                      className="subtle-panel"
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{srv.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>Süre: {srv.duration}</div>
                      </div>
                      <span className="tag tag-neutral tabular">{srv.priceRange}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Transparent TL Pricing & Instant Activation */}
      <section className="section-block" id="paketler">
        <div className="shell-container">
          <h2 className="section-heading">14 Gün Ücretsiz Deneme ile Bugün Aktif Edin</h2>
          <p className="section-sub">
            Kurulum ücreti olmadan kendi WhatsApp hattınıza 10 dakikada bağlayın. Memnun kalmazsanız tek tıkla iptal edin.
          </p>

          <div className="grid-3">
            <div className="surface-card">
              <div className="tag tag-neutral" style={{ marginBottom: '10px' }}>Tek Şube Başlangıç</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '6px' }}>Başlangıç Paketi</h3>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, margin: '10px 0' }} className="tabular">
                {props.starterPriceTry.toLocaleString('tr-TR')} ₺ <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--ink-muted)' }}>/ ay</span>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)', marginBottom: '18px' }}>
                7/24 WhatsApp karşılama, hizmet/fiyat yanıtlama ve aylık 300 otomatik randevu kaydı.
              </p>
              <button
                id="select-starter-plan-btn"
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%' }}
                onClick={() => {
                  setSelectedPlan('starter');
                  setCheckoutResult(null);
                }}
              >
                14 Gün Ücretsiz Başlat
              </button>
            </div>

            <div className="surface-card" style={{ borderColor: 'var(--accent-primary)' }}>
              <div className="tag tag-emerald" style={{ marginBottom: '10px' }}>En Çok Tercih Edilen</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '6px' }}>Profesyonel Paket</h3>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, margin: '10px 0' }} className="tabular">
                {props.proPriceTry.toLocaleString('tr-TR')} ₺ <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--ink-muted)' }}>/ ay</span>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)', marginBottom: '18px' }}>
                Sınırsız WhatsApp + Instagram DM, otomatik randevu hatırlatma (no-show önleyici) ve Google Haritalar yorum otomasyonu.
              </p>
              <button
                id="select-pro-plan-btn"
                type="button"
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => {
                  setSelectedPlan('pro');
                  setCheckoutResult(null);
                }}
              >
                Profesyonel Paketi Dene
              </button>
            </div>

            <div className="surface-card">
              <div className="tag tag-amber" style={{ marginBottom: '10px' }}>Çok Şubeli & Kurumsal B2B</div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '6px' }}>Özel CRM & Kurulum</h3>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, margin: '10px 0' }} className="tabular">
                {props.enterpriseSetupTry.toLocaleString('tr-TR')} ₺ <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--ink-muted)' }}>tek seferlik</span>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)', marginBottom: '18px' }}>
                Mevcut klinik/ofis yazılımınıza özel entegrasyon, çoklu danışman/hekim takvimi ve E-Fatura kurumsal sözleşme.
              </p>
              <button
                id="select-enterprise-plan-btn"
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%' }}
                onClick={() => {
                  setSelectedPlan('enterprise_b2b');
                  setCheckoutResult(null);
                }}
              >
                Kurumsal Teklif İste
              </button>
            </div>
          </div>

          {selectedPlan && (
            <div className="surface-card" style={{ marginTop: '24px', maxWidth: '640px' }} id="demo-checkout-panel">
              {checkoutResult ? (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <CheckCircle2 size={24} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '6px' }}>Başvurunuz Alındı!</h3>
                    <p style={{ color: 'var(--ink-secondary)', fontSize: '0.92rem' }}>{checkoutResult}</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={submitCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.1rem' }}>
                      {props.businessName} — Hızlı Aktivasyon ({selectedPlan.toUpperCase()})
                    </h3>
                    <ShieldCheck size={18} color="var(--accent-primary)" />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="checkout-phone-input">
                      Yetkili Cep / WhatsApp Numaranız
                    </label>
                    <input
                      id="checkout-phone-input"
                      required
                      className="input-control"
                      placeholder="0532 000 00 00"
                      value={checkoutPhone}
                      onChange={(e) => setCheckoutPhone(e.target.value)}
                    />
                  </div>
                  {selectedPlan !== 'enterprise_b2b' && (
                    <div>
                      <label className="field-label" htmlFor="checkout-provider-select">
                        14 Gün Sonrası Tercih Edilen Ödeme Altyapısı
                      </label>
                      <select
                        id="checkout-provider-select"
                        className="select-control"
                        value={checkoutProvider}
                        onChange={(e) => setCheckoutProvider(e.target.value as 'paytr' | 'iyzico' | 'shopier')}
                      >
                        <option value="paytr">PayTR Güvenli Kart (Taksit Destekli)</option>
                        <option value="iyzico">İyzico Korumalı Ödeme</option>
                        <option value="shopier">Shopier Hızlı Abonelik</option>
                      </select>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button id="confirm-checkout-btn" type="submit" className="btn btn-primary" disabled={submittingOrder}>
                      {submittingOrder ? 'İşleniyor...' : 'Aktivasyonu Tamamla'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setSelectedPlan(null)}>
                      Vazgeç
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
