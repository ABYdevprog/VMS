'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ExternalLink,
  Play,
  QrCode,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';

interface PlaybookRecord {
  version: number;
  systemPrompt: string;
  winningPatternsJson: string;
  kaizenReason: string;
  createdAt: string;
}

interface AgentRecord {
  id: string;
  codename: string;
  title: string;
  department: string;
  modelId: string;
  thinkingLevel: string;
  dailyBudgetUsd: number;
  playbookVersion: number;
  tasksCompleted: number;
  todaySpendUsd: number;
  latestPlaybook: PlaybookRecord | null;
  previousPlaybook: PlaybookRecord | null;
}

interface ApprovalItem {
  id: number;
  code: string;
  gateKey: string;
  agentId: string;
  title: string;
  summary: string;
  status: string;
  messageBody: string | null;
  variant: string | null;
  demoSlug: string | null;
  leadName: string | null;
  waMeUrl: string | null;
  createdAt: string;
}

interface OverviewPayload {
  kpis: {
    totalMrrTry: number;
    activeOrdersCount: number;
    leadsCount: number;
    demosCount: number;
    totalDemoViews: number;
    totalDemoChats: number;
    totalAppointmentsSim: number;
    pendingApprovalsCount: number;
    todayTotalSpendUsd: number;
  };
  agents: AgentRecord[];
  shifts: Array<{
    id: number;
    shiftType: string;
    shiftDate: string;
    triggerSource: string;
    status: string;
    summary: string;
    startedAt: string;
  }>;
  tasks: Array<{
    id: number;
    agentId: string;
    title: string;
    executionMode: string;
    modelUsed: string;
    outputSummary: string;
    artifactPath: string | null;
    createdAt: string;
  }>;
  policies: Array<{
    gateKey: string;
    label: string;
    description: string;
    mode: 'REQUIRE_APPROVAL' | 'FULL_AUTO';
    dailyCap: number;
  }>;
  approvals: ApprovalItem[];
  leads: Array<{
    id: number;
    businessName: string;
    slug: string;
    sector: string;
    city: string;
    district: string;
    phone: string;
    leadScore: number;
    stage: string;
  }>;
  demos: Array<{
    id: number;
    slug: string;
    headline: string;
    city: string;
    viewsCount: number;
    chatsCount: number;
    appointmentsBookedCount: number;
    checkoutClicksCount: number;
  }>;
  orders: Array<{
    id: number;
    orderNumber: string;
    businessName: string;
    planTier: string;
    amountTry: number;
    paymentProvider: string;
    status: string;
  }>;
  kaizenLogs: Array<{
    id: number;
    evaluatedDate: string;
    winningVariant: string;
    topSector: string;
    conversionRatePct: number;
    insightsSummary: string;
    upgradedAgentsJson: string;
  }>;
  settings: Record<string, string>;
  whatsapp: {
    status: string;
    qrDataUrl: string | null;
    connectedPhone: string | null;
    lastError: string | null;
    recentLogs: Array<{ direction: 'in' | 'out'; text: string; at: string }>;
  };
}

export default function CeoCockpitClient() {
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'approvals' | 'agents' | 'crm' | 'whatsapp'>('overview');
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [cooInput, setCooInput] = useState('');
  const [cooReply, setCooReply] = useState<string | null>(null);

  const [waTestInput, setWaTestInput] = useState('');
  const [settingsDraft, setSettingsDraft] = useState<Record<string, string>>({});

  const refreshData = useCallback(async () => {
    const res = await fetch('/api/vms/overview', { cache: 'no-store' });
    const json = (await res.json()) as OverviewPayload;
    setData(json);
    setSettingsDraft((prev) => (Object.keys(prev).length === 0 ? json.settings : prev));
  }, []);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }

  async function triggerShift(shiftType: string, label: string) {
    setBusyMessage(`${label} çalıştırılıyor...`);
    try {
      const res = await fetch('/api/vms/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftType }),
      });
      const out = (await res.json()) as { ok: boolean; result?: { summary: string }; ranCount?: number; error?: string };
      if (out.ok) {
        notify(out.result?.summary || `${out.ranCount ?? 1} vardiya başarıyla tamamlandı.`);
        await refreshData();
      } else {
        notify(`Hata: ${out.error}`);
      }
    } finally {
      setBusyMessage(null);
    }
  }

  async function sendDirectiveToCoo(e: React.FormEvent) {
    e.preventDefault();
    if (!cooInput.trim()) return;
    setBusyMessage('COO Atlas komutu işliyor...');
    try {
      const res = await fetch('/api/vms/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cooInput }),
      });
      const out = (await res.json()) as { ok: boolean; reply?: string };
      if (out.ok && out.reply) {
        setCooReply(out.reply);
        setCooInput('');
        await refreshData();
      }
    } finally {
      setBusyMessage(null);
    }
  }

  async function handleApprovalAction(
    action: 'APPROVE' | 'REJECT' | 'APPROVE_ALL',
    code?: string
  ) {
    setBusyMessage('Onay işlemi yürütülüyor...');
    try {
      const res = await fetch('/api/vms/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, code }),
      });
      const out = (await res.json()) as { ok: boolean; detail?: string; approvedCount?: number };
      if (out.ok) {
        notify(out.detail || `${out.approvedCount ?? 0} kayıt onaylandı.`);
        await refreshData();
      }
    } finally {
      setBusyMessage(null);
    }
  }

  async function togglePolicyMode(gateKey: string, currentMode: 'REQUIRE_APPROVAL' | 'FULL_AUTO') {
    const nextMode = currentMode === 'REQUIRE_APPROVAL' ? 'FULL_AUTO' : 'REQUIRE_APPROVAL';
    await fetch('/api/vms/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'TOGGLE_POLICY', gateKey, mode: nextMode }),
    });
    notify(`${gateKey} politikası ${nextMode === 'FULL_AUTO' ? 'Tam Otomatik' : 'Manuel Onay'} moduna alındı.`);
    await refreshData();
  }

  async function updateAgentConfig(agentId: string, modelId: string, thinkingLevel: string) {
    await fetch('/api/vms/agents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, modelId, thinkingLevel }),
    });
    notify(`${agentId.toUpperCase()} model yapılandırması kaydedildi.`);
    await refreshData();
  }

  async function startQrPairing() {
    setBusyMessage('WhatsApp QR oturumu hazırlanıyor...');
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'START_QR' }),
      });
      await res.json();
      await refreshData();
    } finally {
      setBusyMessage(null);
    }
  }

  async function simulateWhatsAppCommand(e: React.FormEvent) {
    e.preventDefault();
    if (!waTestInput.trim()) return;
    const res = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'SIMULATE_CEO_MSG', text: waTestInput }),
    });
    const out = (await res.json()) as { ok: boolean; reply?: string };
    if (out.ok) {
      setWaTestInput('');
      notify('WhatsApp komutu işlendi.');
      await refreshData();
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setBusyMessage('Ayarlar kaydediliyor...');
    try {
      await fetch('/api/vms/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsDraft }),
      });
      notify('Sistem ve WhatsApp ayarları kaydedildi.');
      await refreshData();
    } finally {
      setBusyMessage(null);
    }
  }

  if (!data) {
    return (
      <div className="shell-container" style={{ padding: '64px 24px' }}>
        <p style={{ color: 'var(--ink-secondary)' }}>VMS CEO Kokpiti yükleniyor...</p>
      </div>
    );
  }

  const pendingApprovals = data.approvals.filter((a) => a.status === 'PENDING');

  return (
    <div>
      <header className="site-header">
        <div className="shell-container site-header-inner">
          <div className="brand-mark">
            <span className="brand-emblem">V</span>
            <div>
              <div>VMS CEO Kokpiti</div>
              <div style={{ fontSize: '0.73rem', fontWeight: 500, color: 'var(--ink-muted)' }}>
                7 Uzman Ajan • Günlük 4 Vardiya • Kaizen Öz-Gelişim
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className="tag tag-emerald">
              Mod: {data.settings.has_gemini_key === 'true' ? 'Gemini 4 API Aktif' : 'Antigravity Yerleşik ($0 API)'}
            </span>
            <button
              id="refresh-cockpit-btn"
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void refreshData()}
            >
              <RefreshCw size={14} /> Yenile
            </button>
            <Link href="/" className="btn btn-secondary btn-sm">
              KOBİ Vitrini <ExternalLink size={13} />
            </Link>
          </div>
        </div>
      </header>

      <main className="shell-container" style={{ paddingTop: '26px', paddingBottom: '64px' }}>
        {toast && (
          <div
            className="surface-card"
            style={{
              marginBottom: '18px',
              padding: '12px 16px',
              background: 'var(--accent-soft)',
              borderColor: 'var(--accent-primary)',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            {toast}
          </div>
        )}

        {busyMessage && (
          <div
            className="subtle-panel"
            style={{ marginBottom: '18px', fontWeight: 600, color: 'var(--amber-ink)', background: 'var(--amber-soft)' }}
          >
            ⏳ {busyMessage}
          </div>
        )}

        <h1 style={{ fontSize: 'clamp(1.45rem, 2.4vw, 1.9rem)', marginBottom: '18px' }}>
          Otonom Yazılım Ajansı Yönetim Merkezi
        </h1>

        {/* KPI Strip */}
        <div className="kpi-strip" style={{ marginBottom: '26px' }}>
          <div className="kpi-box">
            <div className="kpi-label">Aylık Düzenli Gelir (MRR)</div>
            <div className="kpi-value">{data.kpis.totalMrrTry.toLocaleString('tr-TR')} ₺</div>
            <div className="kpi-meta">{data.kpis.activeOrdersCount} aktif deneme / sipariş</div>
          </div>
          <div className="kpi-box">
            <div className="kpi-label">KOBİ Havuzu & Canlı Demolar</div>
            <div className="kpi-value">
              {data.kpis.leadsCount} / {data.kpis.demosCount}
            </div>
            <div className="kpi-meta">Her işletmeye özel /demo/[slug]</div>
          </div>
          <div className="kpi-box">
            <div className="kpi-label">Canlı Demo Etkileşimi</div>
            <div className="kpi-value">
              {data.kpis.totalDemoViews} görüntü • {data.kpis.totalDemoChats} sohbet
            </div>
            <div className="kpi-meta">{data.kpis.totalAppointmentsSim} test randevusu alındı</div>
          </div>
          <div className="kpi-box">
            <div className="kpi-label">CEO Onay Kuyruğu</div>
            <div className="kpi-value">{data.kpis.pendingApprovalsCount}</div>
            <div className="kpi-meta">Tek tıkla gönderime hazır</div>
          </div>
          <div className="kpi-box">
            <div className="kpi-label">Bugünkü API Harcaması</div>
            <div className="kpi-value">${data.kpis.todayTotalSpendUsd.toFixed(3)}</div>
            <div className="kpi-meta">Kalkan Limiti: ${data.settings.daily_total_budget_usd || '3.00'}/gün</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="tab-bar">
          <button
            id="tab-overview"
            type="button"
            className={`tab-btn ${activeTab === 'overview' ? 'tab-btn-active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Vardiyalar & COO Komuta
          </button>
          <button
            id="tab-approvals"
            type="button"
            className={`tab-btn ${activeTab === 'approvals' ? 'tab-btn-active' : ''}`}
            onClick={() => setActiveTab('approvals')}
          >
            Onay Kuyruğu ({pendingApprovals.length}) & Korkuluklar
          </button>
          <button
            id="tab-agents"
            type="button"
            className={`tab-btn ${activeTab === 'agents' ? 'tab-btn-active' : ''}`}
            onClick={() => setActiveTab('agents')}
          >
            7 Uzman Ajan & Kaizen Evrimi
          </button>
          <button
            id="tab-crm"
            type="button"
            className={`tab-btn ${activeTab === 'crm' ? 'tab-btn-active' : ''}`}
            onClick={() => setActiveTab('crm')}
          >
            KOBİ CRM & Canlı Demolar ({data.demos.length})
          </button>
          <button
            id="tab-whatsapp"
            type="button"
            className={`tab-btn ${activeTab === 'whatsapp' ? 'tab-btn-active' : ''}`}
            onClick={() => setActiveTab('whatsapp')}
          >
            WhatsApp QR & Sistem Ayarları
          </button>
        </div>

        {/* TAB 1: OVERVIEW & SHIFTS */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div className="surface-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '1.18rem' }}>Günlük 4 Vardiya Otomasyon Kontrolü</h2>
                  <p style={{ fontSize: '0.86rem', color: 'var(--ink-secondary)' }}>
                    Saat Dilimi: Europe/Istanbul (09:00 Sabah • 12:30 Öğle • 16:00 İkindi • 22:00 Gece Kaizen) + Otomatik Telafi
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    id="run-catchup-btn"
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={Boolean(busyMessage)}
                    onClick={() => void triggerShift('catchup', 'Telafi Zamanlayıcısı')}
                  >
                    Eksik Vardiyaları Telafi Et
                  </button>
                  <button
                    id="run-full-day-btn"
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={Boolean(busyMessage)}
                    onClick={() => void triggerShift('full_day', 'Tam Gün (4 Vardiya) Döngüsü')}
                  >
                    <Play size={14} /> Tüm Gün Döngüsünü Çalıştır
                  </button>
                </div>
              </div>

              <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                {[
                  { key: 'morning', time: '09:00', name: 'Sabah Vardiyası', desc: 'Pusula + Mimar + Atlas: KOBİ fırsat taraması ve günlük sprint planı' },
                  { key: 'midday', time: '12:30', name: 'Öğle Vardiyası', desc: 'Demir + Yankı: Demo QA, Antigravity BuildSpec ve Türkçe SEO yayını' },
                  { key: 'afternoon', time: '16:00', name: 'İkindi Vardiyası', desc: 'Avcı + Atlas: Yeni KOBİ puanlama, özel /demo/[slug] ve A/B satış paketi' },
                  { key: 'night', time: '22:00', name: 'Gece Kaizen Vardiyası', desc: 'Bilge: Demo telemetri analizi ve Playbook v+1 öz-gelişim yükseltmesi' },
                ].map((s) => (
                  <div key={s.key} className="subtle-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '0.95rem' }}>{s.name}</strong>
                        <span className="tag tag-neutral mono">{s.time}</span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--ink-secondary)' }}>{s.desc}</p>
                    </div>
                    <button
                      id={`run-shift-${s.key}-btn`}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={Boolean(busyMessage)}
                      onClick={() => void triggerShift(s.key, s.name)}
                    >
                      <Play size={13} /> Şimdi Çalıştır
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid-2">
              {/* Direct COO Directive Box */}
              <div className="surface-card">
                <h2 style={{ fontSize: '1.12rem', marginBottom: '6px' }}>COO Atlas’a Doğrudan Emir Ver</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)', marginBottom: '12px' }}>
                  Aktif Öncelik:{' '}
                  <strong>{data.settings.ceo_active_directive || 'Varsayılan çok sektörlü KOBİ büyüme rotasyonu'}</strong>
                </p>

                <form onSubmit={sendDirectiveToCoo} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    id="coo-directive-input"
                    className="input-control"
                    placeholder="Örn: Yarın İzmir Karşıyaka güzellik merkezlerine odaklanın"
                    value={cooInput}
                    onChange={(e) => setCooInput(e.target.value)}
                  />
                  <button id="coo-directive-send-btn" type="submit" className="btn btn-primary">
                    <Send size={15} /> İlet
                  </button>
                </form>

                {cooReply && (
                  <div className="subtle-panel" style={{ whiteSpace: 'pre-line', fontSize: '0.86rem' }}>
                    {cooReply}
                  </div>
                )}
              </div>

              {/* Recent Shift History */}
              <div className="surface-card">
                <h2 style={{ fontSize: '1.12rem', marginBottom: '12px' }}>Son Vardiya Kayıtları</h2>
                {data.shifts.length === 0 ? (
                  <p style={{ fontSize: '0.88rem', color: 'var(--ink-muted)' }}>
                    Henüz vardiya kaydı yok. Yukarıdan bir vardiyayı başlatabilirsiniz.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
                    {data.shifts.map((sh) => (
                      <div key={sh.id} className="subtle-panel">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.78rem' }}>
                          <span className="tag tag-emerald">{sh.shiftType.toUpperCase()}</span>
                          <span style={{ color: 'var(--ink-muted)' }}>
                            {sh.shiftDate} • Kaynak: {sh.triggerSource}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem' }}>{sh.summary}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Live Agent Activity Stream */}
            <div className="surface-card">
              <h2 style={{ fontSize: '1.12rem', marginBottom: '12px' }}>Canlı Ajan İş Akışı & Üretilen Çıktılar</h2>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ajan</th>
                      <th>Görev</th>
                      <th>Motor / Model</th>
                      <th>Çıktı Özeti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tasks.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <span className="tag tag-neutral">{t.agentId.toUpperCase()}</span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{t.title}</td>
                        <td className="mono" style={{ fontSize: '0.78rem', color: 'var(--ink-secondary)' }}>
                          {t.modelUsed}
                        </td>
                        <td style={{ fontSize: '0.84rem' }}>
                          {t.outputSummary}{' '}
                          {t.artifactPath && t.artifactPath.startsWith('/') && (
                            <Link href={t.artifactPath} style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                              [Aç →]
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: APPROVALS & GUARDRAILS */}
        {activeTab === 'approvals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div className="surface-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h2 style={{ fontSize: '1.18rem' }}>CEO Tek Tık Onay Kuyruğu</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)' }}>
                    Satış ajanının hazırladığı canlı demoları ve mesajları inceleyip tek tıkla onaylayın.
                  </p>
                </div>
                {pendingApprovals.length > 0 && (
                  <button
                    id="approve-all-btn"
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => void handleApprovalAction('APPROVE_ALL')}
                  >
                    <CheckCircle2 size={15} /> Bekleyen Tümünü Onayla ({pendingApprovals.length})
                  </button>
                )}
              </div>

              {data.approvals.length === 0 ? (
                <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem' }}>
                  Onay kuyruğu boş. İkindi vardiyasını çalıştırdığınızda yeni KOBİ demo davetleri buraya düşer.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {data.approvals.map((item) => (
                    <div key={item.id} className="subtle-panel">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="mono" style={{ fontWeight: 700, fontSize: '0.84rem' }}>
                            {item.code}
                          </span>
                          <strong style={{ fontSize: '0.95rem' }}>{item.title}</strong>
                        </div>
                        <span
                          className={`tag ${
                            item.status === 'PENDING'
                              ? 'tag-amber'
                              : item.status === 'REJECTED'
                                ? 'tag-danger'
                                : 'tag-emerald'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <p style={{ fontSize: '0.83rem', color: 'var(--ink-secondary)', marginBottom: '8px' }}>
                        {item.summary}
                      </p>

                      {item.messageBody && (
                        <div
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--line-subtle)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            fontSize: '0.86rem',
                            marginBottom: '10px',
                          }}
                        >
                          {item.messageBody}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {item.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => void handleApprovalAction('APPROVE', item.code)}
                            >
                              <CheckCircle2 size={14} /> Onayla
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => void handleApprovalAction('REJECT', item.code)}
                            >
                              <XCircle size={14} /> Reddet
                            </button>
                          </>
                        )}
                        {item.demoSlug && (
                          <Link href={`/demo/${item.demoSlug}`} className="btn btn-secondary btn-sm">
                            Canlı Demoyu İncele <ExternalLink size={13} />
                          </Link>
                        )}
                        {item.waMeUrl && (
                          <a href={item.waMeUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                            WhatsApp’ta Aç (wa.me) <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Guardrail Switches */}
            <div className="surface-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Shield size={18} color="var(--accent-primary)" />
                <h2 style={{ fontSize: '1.15rem' }}>Akıllı Korkuluklar (Otonomi Onay Kapıları)</h2>
              </div>
              <div className="grid-2">
                {data.policies.map((pol) => (
                  <div key={pol.gateKey} className="subtle-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{pol.label}</div>
                      <p style={{ fontSize: '0.81rem', color: 'var(--ink-secondary)', marginTop: '3px' }}>
                        {pol.description} (Günlük Tavan: {pol.dailyCap})
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`btn btn-sm ${pol.mode === 'FULL_AUTO' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => void togglePolicyMode(pol.gateKey, pol.mode)}
                    >
                      {pol.mode === 'FULL_AUTO' ? 'Tam Otomatik' : 'Manuel Onay'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 7 AGENTS & KAIZEN EVOLUTION */}
        {activeTab === 'agents' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div className="grid-2">
              {data.agents.map((ag) => {
                const winningRules: string[] = ag.latestPlaybook
                  ? JSON.parse(ag.latestPlaybook.winningPatternsJson || '[]')
                  : [];
                return (
                  <div key={ag.id} className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <div>
                        <span className="tag tag-neutral" style={{ marginBottom: '6px' }}>
                          {ag.department}
                        </span>
                        <h3 style={{ fontSize: '1.12rem' }}>
                          {ag.codename} — {ag.title}
                        </h3>
                      </div>
                      <span className="tag tag-emerald mono">Playbook v{ag.playbookVersion}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label className="field-label">Gemini 4 Modeli</label>
                        <select
                          className="select-control"
                          value={ag.modelId}
                          onChange={(e) => void updateAgentConfig(ag.id, e.target.value, ag.thinkingLevel)}
                        >
                          <option value="gemini-4-carbon">gemini-4-carbon (Derin Mimari)</option>
                          <option value="gemini-4-neon">gemini-4-neon (Dengeli Hız/Zeka)</option>
                          <option value="gemini-4-hydrogen">gemini-4-hydrogen (Ücretsiz Katman Açık)</option>
                          <option value="gemini-3.8-flash">gemini-3.8-flash (Hızlı Tarama)</option>
                        </select>
                      </div>
                      <div>
                        <label className="field-label">Düşünme Seviyesi</label>
                        <select
                          className="select-control"
                          value={ag.thinkingLevel}
                          onChange={(e) => void updateAgentConfig(ag.id, ag.modelId, e.target.value)}
                        >
                          <option value="low">low</option>
                          <option value="medium">medium</option>
                          <option value="high">high</option>
                          <option value="xhigh">xhigh (Hydrogen Özel)</option>
                        </select>
                      </div>
                    </div>

                    <div className="subtle-panel" style={{ fontSize: '0.83rem' }}>
                      <div style={{ fontWeight: 700, marginBottom: '4px' }}>Aktif Uzmanlık Kuralları (Kaizen Hafızası):</div>
                      {winningRules.map((r, idx) => (
                        <div key={idx} style={{ color: 'var(--ink-secondary)', marginTop: '3px' }}>
                          • {r}
                        </div>
                      ))}
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Tamamlanan Görev: {ag.tasksCompleted}</span>
                      <span>Son Evrim: {ag.latestPlaybook?.kaizenReason.slice(0, 48)}...</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Kaizen Logs */}
            <div className="surface-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Sparkles size={18} color="var(--accent-primary)" />
                <h2 style={{ fontSize: '1.15rem' }}>Gece Kaizen Öz-Gelişim Raporları</h2>
              </div>
              {data.kaizenLogs.length === 0 ? (
                <p style={{ fontSize: '0.88rem', color: 'var(--ink-muted)' }}>
                  Gece Kaizen vardiyasını çalıştırdığınızda ekibin kendi Playbook kurallarını nasıl geliştirdiği burada listelenir.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.kaizenLogs.map((kz) => (
                    <div key={kz.id} className="subtle-panel">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem' }}>
                        <strong>Tarih: {kz.evaluatedDate}</strong>
                        <span className="tag tag-emerald">
                          Kazanan Varyant: {kz.winningVariant} • Demo Dönüşümü: %{kz.conversionRatePct}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.86rem', color: 'var(--ink-secondary)' }}>{kz.insightsSummary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: CRM & DEMOS */}
        {activeTab === 'crm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div className="surface-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Users size={18} color="var(--accent-primary)" />
                <h2 style={{ fontSize: '1.15rem' }}>KOBİ Satış Hunisi & Canlı Demo Telemetrisi</h2>
              </div>

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>İşletme</th>
                      <th>Bölge / Sektör</th>
                      <th>Puan</th>
                      <th>Aşama</th>
                      <th>Demo Etkileşimi</th>
                      <th>Canlı Bağlantı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leads.map((lead) => {
                      const dm = data.demos.find((d) => d.slug === lead.slug);
                      return (
                        <tr key={lead.id}>
                          <td style={{ fontWeight: 600 }}>{lead.businessName}</td>
                          <td>
                            {lead.city}/{lead.district} • <span className="mono">{lead.sector}</span>
                          </td>
                          <td className="tabular">
                            <strong>{lead.leadScore}</strong>/100
                          </td>
                          <td>
                            <span
                              className={`tag ${
                                lead.stage === 'WON' || lead.stage === 'HOT_ENGAGED' ? 'tag-emerald' : 'tag-neutral'
                              }`}
                            >
                              {lead.stage}
                            </span>
                          </td>
                          <td className="tabular" style={{ fontSize: '0.83rem' }}>
                            {dm
                              ? `${dm.viewsCount} açılış • ${dm.chatsCount} AI sohbet • ${dm.appointmentsBookedCount} randevu`
                              : '-'}
                          </td>
                          <td>
                            {dm && (
                              <Link href={`/demo/${dm.slug}`} className="btn btn-secondary btn-sm">
                                /demo/{dm.slug.slice(0, 18)}...
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {data.orders.length > 0 && (
              <div className="surface-card">
                <h2 style={{ fontSize: '1.15rem', marginBottom: '12px' }}>Gelen Abonelik & Kurumsal Siparişler</h2>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Sipariş No</th>
                        <th>İşletme</th>
                        <th>Paket</th>
                        <th>Tutar</th>
                        <th>Altyapı</th>
                        <th>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.orders.map((ord) => (
                        <tr key={ord.id}>
                          <td className="mono">{ord.orderNumber}</td>
                          <td style={{ fontWeight: 600 }}>{ord.businessName}</td>
                          <td>{ord.planTier.toUpperCase()}</td>
                          <td className="tabular">{ord.amountTry.toLocaleString('tr-TR')} ₺</td>
                          <td>{ord.paymentProvider.toUpperCase()}</td>
                          <td>
                            <span className="tag tag-emerald">{ord.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: WHATSAPP QR & SETTINGS */}
        {activeTab === 'whatsapp' && (
          <div className="grid-2" style={{ alignItems: 'start' }}>
            <div className="surface-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '1.15rem' }}>Çift Yönlü WhatsApp CEO Köprüsü</h2>
                <span className="tag tag-emerald">{data.whatsapp.status.toUpperCase()}</span>
              </div>
              <p style={{ fontSize: '0.86rem', color: 'var(--ink-secondary)', marginBottom: '16px' }}>
                Telefonunuzdaki WhatsApp → <strong>Bağlı Cihazlar</strong> menüsünden aşağıdaki QR kodu okutarak vardiya
                raporlarını doğrudan WhatsApp’tan alabilir ve <code>TUMUNU ONAYLA</code> veya Türkçe talimat yazabilirsiniz.
              </p>

              <button
                id="start-whatsapp-qr-btn"
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void startQrPairing()}
              >
                <QrCode size={15} /> WhatsApp QR Kodu Oluştur / Yenile
              </button>

              {data.whatsapp.qrDataUrl && (
                <div style={{ marginTop: '16px', textAlign: 'center' }} className="subtle-panel">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={data.whatsapp.qrDataUrl}
                    alt="WhatsApp Eşleştirme QR Kodu"
                    style={{ width: '240px', height: '240px', borderRadius: '8px' }}
                  />
                  <div style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', marginTop: '6px' }}>
                    WhatsApp → Bağlı Cihazlar → Cihaz Bağla menüsünden okutun
                  </div>
                </div>
              )}

              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--line-subtle)' }}>
                <h3 style={{ fontSize: '0.96rem', marginBottom: '8px' }}>WhatsApp CEO Komut Test Konsolu</h3>
                <form onSubmit={simulateWhatsAppCommand} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    id="wa-sim-input"
                    className="input-control"
                    placeholder="Örn: DURUM veya TUMUNU ONAYLA"
                    value={waTestInput}
                    onChange={(e) => setWaTestInput(e.target.value)}
                  />
                  <button type="submit" className="btn btn-secondary btn-sm">
                    Gönder
                  </button>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                  {data.whatsapp.recentLogs.map((lg, idx) => (
                    <div key={idx} className="subtle-panel" style={{ fontSize: '0.8rem', whiteSpace: 'pre-line' }}>
                      <strong>{lg.direction === 'in' ? '📥 CEO:' : '📤 VMS:'}</strong> {lg.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <form onSubmit={saveSettings} className="surface-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h2 style={{ fontSize: '1.15rem' }}>Sistem, Ödeme & Opsiyonel API Ayarları</h2>

              <div>
                <label className="field-label">CEO WhatsApp Telefon Numarası (Bildirim & Yetki İçin)</label>
                <input
                  className="input-control"
                  placeholder="+905320000000"
                  value={settingsDraft.ceo_whatsapp_phone || ''}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, ceo_whatsapp_phone: e.target.value })}
                />
              </div>

              <div>
                <label className="field-label">
                  Opsiyonel Google AI Studio Anahtarı (GEMINI_API_KEY — Boş Bırakılırsa $0 Antigravity Modu Çalışır)
                </label>
                <input
                  className="input-control"
                  placeholder="AIzaSy... (İsteğe bağlı: Hydrogen ücretsiz / Carbon kredili)"
                  value={settingsDraft.gemini_api_key || ''}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, gemini_api_key: e.target.value })}
                />
              </div>

              <div>
                <label className="field-label">Varsayılan TR Ödeme Altyapısı</label>
                <select
                  className="select-control"
                  value={settingsDraft.payment_provider || 'paytr'}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, payment_provider: e.target.value })}
                >
                  <option value="paytr">PayTR Sanal POS</option>
                  <option value="iyzico">İyzico Korumalı Ödeme</option>
                  <option value="shopier">Shopier Hızlı Link</option>
                </select>
              </div>

              <div>
                <label className="field-label">Müşteriye Giden Halka Açık Demo Kök Adresi (GitHub/Vercel Yayını)</label>
                <input
                  className="input-control"
                  value={settingsDraft.public_base_url || ''}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, public_base_url: e.target.value })}
                />
              </div>

              <div>
                <label className="field-label">Günlük Maksimum API Kredi Kalkanı (USD)</label>
                <input
                  className="input-control"
                  value={settingsDraft.daily_total_budget_usd || '3.00'}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, daily_total_budget_usd: e.target.value })}
                />
              </div>

              <button id="save-vms-settings-btn" type="submit" className="btn btn-primary">
                Ayarları Kaydet
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
