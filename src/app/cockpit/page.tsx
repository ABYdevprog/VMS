import type { Metadata } from 'next';
import CeoCockpitClient from '@/components/cockpit/CeoCockpitClient';

export const metadata: Metadata = {
  title: 'CEO Kontrol Kokpiti | VMS Otonom Yazılım Ajansı',
  description: '7 uzman ajan, günlük 4 vardiya, Kaizen öz-gelişim ve WhatsApp QR onay yönetimi.',
};

export default function CockpitPage() {
  return <CeoCockpitClient />;
}
