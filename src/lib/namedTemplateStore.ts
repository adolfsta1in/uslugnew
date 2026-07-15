import { getSupabase, isSupabaseConfigured } from "./supabaseClient";
import type { Certificate } from "./certificate";

// ============================================================================
// Именованные шаблоны заполненного сертификата.
// Пользователь заполняет бланк и сохраняет его под своим названием
// («Сохранить шаблон»), а затем находит и подставляет через окно «Шаблоны».
//
// В отличие от templateStore.ts (правки ПОСТОЯННОГО текста бланка), здесь
// хранится полный НАБОР ЗНАЧЕНИЙ полей сертификата под заданным именем.
//
// Хранится в Supabase (таблица `certificate_templates`, поля — в JSONB `cert`),
// плюс локальный кэш в браузере — чтобы список открывался мгновенно и работал
// офлайн, если Supabase не настроен.
// ============================================================================

const TABLE = "certificate_templates";
const CACHE_KEY = "cert-named-templates-cache-v1";

/** Один сохранённый шаблон: имя + снимок значений полей сертификата. */
export interface NamedTemplate {
  id: string;
  name: string;
  cert: Certificate;
  created_at?: string;
  updated_at?: string;
}

interface Row {
  id: string;
  name: string;
  cert: Certificate;
  created_at?: string;
  updated_at?: string;
}

function fromRow(r: Row): NamedTemplate {
  return { id: r.id, name: r.name, cert: r.cert, created_at: r.created_at, updated_at: r.updated_at };
}

/** Кэш шаблонов из localStorage (для мгновенного открытия окна «Шаблоны»). */
export function getCachedTemplates(): NamedTemplate[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(CACHE_KEY) : null;
    const arr = raw ? (JSON.parse(raw) as NamedTemplate[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function setCache(list: NamedTemplate[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Загрузить все шаблоны (новые сверху) и обновить кэш. */
export async function listTemplates(): Promise<NamedTemplate[]> {
  if (!isSupabaseConfigured) return getCachedTemplates();
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const list = ((data ?? []) as Row[]).map(fromRow);
  setCache(list);
  return list;
}

/**
 * Сохранить шаблон под именем. Если шаблон с таким именем (без учёта регистра)
 * уже есть — перезаписывает его значения. Возвращает сохранённый шаблон.
 */
export async function saveTemplate(name: string, cert: Certificate): Promise<NamedTemplate> {
  const clean = name.trim();
  // id/служебные поля в снимок не пишем — это данные записи, а не шаблона.
  const { id: _id, created_at: _c, updated_at: _u, ...snapshot } = cert;
  const payload = snapshot as Certificate;

  const existing = await findByName(clean);
  if (existing) {
    const { data, error } = await getSupabase()
      .from(TABLE)
      .update({ name: clean, cert: payload })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    const saved = fromRow(data as Row);
    setCache(replaceInCache(saved));
    return saved;
  }

  const { data, error } = await getSupabase()
    .from(TABLE)
    .insert({ name: clean, cert: payload })
    .select()
    .single();
  if (error) throw error;
  const saved = fromRow(data as Row);
  setCache([saved, ...getCachedTemplates().filter((t) => t.id !== saved.id)]);
  return saved;
}

/** Найти шаблон по точному имени (без учёта регистра) или null. */
export async function findByName(name: string): Promise<NamedTemplate | null> {
  if (!isSupabaseConfigured) {
    const clean = name.trim().toLowerCase();
    return getCachedTemplates().find((t) => t.name.trim().toLowerCase() === clean) ?? null;
  }
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .ilike("name", name.trim())
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as Row) : null;
}

/** Удалить шаблон по id. */
export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await getSupabase().from(TABLE).delete().eq("id", id);
  if (error) throw error;
  setCache(getCachedTemplates().filter((t) => t.id !== id));
}

function replaceInCache(saved: NamedTemplate): NamedTemplate[] {
  const rest = getCachedTemplates().filter((t) => t.id !== saved.id);
  return [saved, ...rest];
}
