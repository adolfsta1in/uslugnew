"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "./Toast";
import {
  Abbreviation,
  listAbbreviations,
  insertAbbreviation,
  updateAbbreviation,
  deleteAbbreviation,
} from "../lib/abbreviations";
import { isSupabaseConfigured } from "../lib/supabaseClient";

// ============================================================================
// Настройки автозамен: пользователь задаёт сокращения (короткая → полная форма).
// В полях бланка при вводе короткой формы + пробел она заменяется на полную.
// ============================================================================

export default function AbbreviationsSettings() {
  const [rows, setRows] = useState<Abbreviation[]>([]);
  const [loading, setLoading] = useState(true);
  const [newShort, setNewShort] = useState("");
  const [newFull, setNewFull] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listAbbreviations());
    } catch (e) {
      toast("Ошибка загрузки сокращений: " + (e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    const short = newShort.trim();
    const full = newFull.trim();
    if (!short || !full) {
      toast("Заполните оба поля: сокращение и полный текст", "error");
      return;
    }
    if (!isSupabaseConfigured) {
      toast("Supabase не настроен — задайте переменные окружения (.env.local)", "error");
      return;
    }
    setSaving(true);
    try {
      const saved = await insertAbbreviation({ short, full });
      setRows((prev) => [...prev, saved].sort((a, b) => a.short.localeCompare(b.short, "ru")));
      setNewShort("");
      setNewFull("");
      toast("Сокращение добавлено", "success");
    } catch (e) {
      toast("Ошибка добавления: " + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (id: string | undefined, key: "short" | "full", value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  };

  const handleSaveRow = async (row: Abbreviation) => {
    if (!row.id) return;
    if (!row.short.trim() || !row.full.trim()) {
      toast("Сокращение и полный текст не могут быть пустыми", "error");
      return;
    }
    try {
      await updateAbbreviation(row.id, { short: row.short.trim(), full: row.full.trim() });
      toast("Сохранено", "success");
    } catch (e) {
      toast("Ошибка сохранения: " + (e as Error).message, "error");
      load();
    }
  };

  const handleDelete = async (row: Abbreviation) => {
    if (!row.id) return;
    if (!window.confirm(`Удалить сокращение «${row.short}»?`)) return;
    try {
      await deleteAbbreviation(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast("Удалено", "success");
    } catch (e) {
      toast("Ошибка удаления: " + (e as Error).message, "error");
    }
  };

  const cellInput: React.CSSProperties = {
    width: "100%",
    padding: "7px 9px",
    border: "1px solid var(--border)",
    borderRadius: 7,
    fontSize: 14,
  };

  return (
    <div className="no-print" style={{ maxWidth: 820, margin: "0 auto", padding: "24px 20px 60px" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Автозамены (сокращения)</h2>
      <p style={{ margin: "0 0 18px", color: "var(--muted)", fontSize: 13.5, lineHeight: 1.5 }}>
        Задайте сокращения: при вводе короткой формы в поле бланка и нажатии пробела она
        автоматически заменится на полный текст. Например, <b>тҷ</b> → <b>Тоҷикстандарт</b>. Данные
        хранятся в Supabase и применяются на всех устройствах.
      </p>

      {!isSupabaseConfigured && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderLeft: "3px solid #ef4444",
            background: "#fef2f2",
            borderRadius: "0 8px 8px 0",
            fontSize: 13,
          }}
        >
          Supabase не настроен: задайте <code>NEXT_PUBLIC_SUPABASE_URL</code> и{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> в <code>.env.local</code>, иначе изменения не
          сохранятся.
        </div>
      )}

      {/* Добавление */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr auto",
          gap: 8,
          alignItems: "end",
          padding: 14,
          background: "#fff",
          border: "1px solid var(--border)",
          borderRadius: 10,
          marginBottom: 18,
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span style={{ color: "var(--muted)" }}>Сокращение</span>
          <input
            style={cellInput}
            value={newShort}
            placeholder="напр. тҷ"
            onChange={(e) => setNewShort(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          <span style={{ color: "var(--muted)" }}>Полный текст</span>
          <input
            style={cellInput}
            value={newFull}
            placeholder="напр. Тоҷикстандарт"
            onChange={(e) => setNewFull(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
        </label>
        <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>
          ➕ Добавить
        </button>
      </div>

      {/* Список */}
      {loading ? (
        <div style={{ padding: 20, color: "var(--muted)" }}>Загрузка…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 20, color: "var(--muted)" }}>Пока нет сокращений.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr auto auto",
              gap: 8,
              fontSize: 12,
              color: "var(--muted)",
              padding: "0 4px",
              fontWeight: 600,
            }}
          >
            <span>Сокращение</span>
            <span>Полный текст</span>
            <span />
            <span />
          </div>
          {rows.map((row) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 2fr auto auto",
                gap: 8,
                alignItems: "center",
                padding: 8,
                background: "#fff",
                border: "1px solid var(--border)",
                borderRadius: 10,
              }}
            >
              <input
                style={cellInput}
                value={row.short}
                onChange={(e) => handleFieldChange(row.id, "short", e.target.value)}
              />
              <input
                style={cellInput}
                value={row.full}
                onChange={(e) => handleFieldChange(row.id, "full", e.target.value)}
              />
              <button className="btn btn-sm" onClick={() => handleSaveRow(row)}>
                💾 Сохранить
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => handleDelete(row)}>
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
