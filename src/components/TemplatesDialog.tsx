"use client";

import { useEffect, useMemo, useState } from "react";
import {
  NamedTemplate,
  listTemplates,
  getCachedTemplates,
  deleteTemplate,
} from "../lib/namedTemplateStore";
import { toast } from "./Toast";

// ============================================================================
// Окно «Шаблоны» — поиск и подстановка сохранённых шаблонов сертификата.
// Пользователь ищет шаблон по названию, нажимает «Подставить» (значения полей
// загружаются в бланк) или «Удалить». Данные хранятся в Supabase с локальным
// кэшем (см. namedTemplateStore.ts).
// ============================================================================

interface Props {
  open: boolean;
  onLoad: (tpl: NamedTemplate) => void;
  onClose: () => void;
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function TemplatesDialog({ open, onLoad, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [templates, setTemplates] = useState<NamedTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  // При открытии: сразу показываем кэш, затем обновляем из Supabase.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setTemplates(getCachedTemplates());
    setLoading(true);
    listTemplates()
      .then(setTemplates)
      .catch((e) => toast("Ошибка загрузки шаблонов: " + (e as Error).message, "error"))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, query]);

  if (!open) return null;

  const handleDelete = async (tpl: NamedTemplate) => {
    if (!window.confirm(`Удалить шаблон «${tpl.name}»?`)) return;
    try {
      await deleteTemplate(tpl.id);
      setTemplates((list) => list.filter((t) => t.id !== tpl.id));
      toast("Шаблон удалён", "info");
    } catch (e) {
      toast("Ошибка удаления: " + (e as Error).message, "error");
    }
  };

  return (
    <div className="sort-overlay" onMouseDown={onClose}>
      <div
        className="sort-dialog"
        style={{ width: "min(560px, 94vw)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sort-titlebar">
          <span>Шаблоны сертификатов</span>
          <button className="sort-x" onClick={onClose} title="Закрыть">
            ✕
          </button>
        </div>

        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Поиск по названию шаблона…"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 14,
            }}
          />
        </div>

        <div style={{ padding: "8px 14px", maxHeight: "50vh", overflow: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "24px 8px", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
              {loading
                ? "Загрузка…"
                : templates.length === 0
                ? "Пока нет сохранённых шаблонов. Заполните бланк и нажмите «Сохранить шаблон»."
                : "Ничего не найдено по вашему запросу."}
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {filtered.map((tpl) => (
                <li
                  key={tpl.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "#fff",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={tpl.name}
                    >
                      {tpl.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      {tpl.cert.service_name || "без наименования"} · {formatDate(tpl.updated_at)}
                    </div>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => onLoad(tpl)}>
                    Подставить
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(tpl)}
                    title="Удалить шаблон"
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="sort-footer">
          <button className="btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
