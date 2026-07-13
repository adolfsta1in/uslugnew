"use client";

import dynamic from "next/dynamic";

// Настройки работают только на клиенте (Supabase, localStorage).
const AbbreviationsSettings = dynamic(() => import("../../components/AbbreviationsSettings"), {
  ssr: false,
  loading: () => <div style={{ padding: 24 }}>Загрузка настроек…</div>,
});

export default function SettingsPage() {
  return <AbbreviationsSettings />;
}
