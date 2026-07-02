"use client";

import { useEffect, useState } from "react";

// Лёгкая система уведомлений без внешних зависимостей.
// Любой компонент вызывает toast("...", "success"), а <Toasts/> их отображает.

type ToastType = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l([...items]);
}

/** Показать уведомление. */
export function toast(message: string, type: ToastType = "info") {
  const id = nextId++;
  items = [...items, { id, message, type }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 3500);
}

const colors: Record<ToastType, { bg: string; border: string }> = {
  success: { bg: "#ecfdf5", border: "#10b981" },
  error: { bg: "#fef2f2", border: "#ef4444" },
  info: { bg: "#eff6ff", border: "#3b82f6" },
};

/** Контейнер уведомлений — разместить один раз в layout/страницах. */
export default function Toasts() {
  const [list, setList] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setList);
    setList([...items]);
    return () => {
      listeners.delete(setList);
    };
  }, []);

  return (
    <div
      className="no-print"
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 100,
      }}
    >
      {list.map((t) => (
        <div
          key={t.id}
          style={{
            minWidth: 220,
            maxWidth: 360,
            padding: "10px 14px",
            borderRadius: 8,
            background: colors[t.type].bg,
            borderLeft: `4px solid ${colors[t.type].border}`,
            boxShadow: "0 4px 14px rgba(15,23,42,0.12)",
            fontSize: 14,
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
