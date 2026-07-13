import { getSupabase, isSupabaseConfigured } from "./supabaseClient";

// ============================================================================
// Справочник автозамен (сокращений).
// Хранится в Supabase (таблица `abbreviations`), плюс локальный кэш в браузере —
// чтобы автоподстановка в полях работала мгновенно и даже офлайн.
// ============================================================================

export interface Abbreviation {
  id?: string;
  short: string; // короткая форма (что вводит пользователь)
  full: string; // полная форма (на что заменяется)
  created_at?: string;
  updated_at?: string;
}

const TABLE = "abbreviations";
const CACHE_KEY = "cert-abbr-cache-v1";

/** Кэш сокращений из localStorage (для мгновенной автоподстановки). */
export function getCachedAbbreviations(): Abbreviation[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(CACHE_KEY) : null;
    return raw ? (JSON.parse(raw) as Abbreviation[]) : [];
  } catch {
    return [];
  }
}

function setCache(list: Abbreviation[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Загрузить все сокращения (и обновить кэш). */
export async function listAbbreviations(): Promise<Abbreviation[]> {
  if (!isSupabaseConfigured) return getCachedAbbreviations();
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .order("short", { ascending: true });
  if (error) throw error;
  const list = (data ?? []) as Abbreviation[];
  setCache(list);
  return list;
}

/** Добавить сокращение. */
export async function insertAbbreviation(a: Abbreviation): Promise<Abbreviation> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .insert({ short: a.short, full: a.full })
    .select()
    .single();
  if (error) throw error;
  return data as Abbreviation;
}

/** Изменить сокращение. */
export async function updateAbbreviation(id: string, patch: Abbreviation): Promise<Abbreviation> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .update({ short: patch.short, full: patch.full })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Abbreviation;
}

/** Удалить сокращение. */
export async function deleteAbbreviation(id: string): Promise<void> {
  const { error } = await getSupabase().from(TABLE).delete().eq("id", id);
  if (error) throw error;
}
