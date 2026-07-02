import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Только публичные переменные окружения (NEXT_PUBLIC_*) — они попадают в браузер.
// service_role / secret ключ здесь использовать НЕЛЬЗЯ.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** true, если заданы переменные окружения Supabase. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/**
 * Возвращает singleton-клиент Supabase.
 * Бросает понятную ошибку, если переменные окружения не заданы —
 * вызывающий код показывает её пользователю (toast).
 */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase не настроен. Задайте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в .env.local"
    );
  }
  if (!client) {
    client = createClient(url as string, anonKey as string);
  }
  return client;
}
