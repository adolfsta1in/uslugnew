"use client";

import dynamic from "next/dynamic";

// AG Grid работает только на клиенте — отключаем SSR.
const RegistryGrid = dynamic(() => import("../../components/RegistryGrid"), {
  ssr: false,
  loading: () => <div style={{ padding: 24 }}>Загрузка реестра…</div>,
});

export default function RegistryPage() {
  return <RegistryGrid />;
}
