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
    client = createClient(url as string, anonKey as string, {
      auth: {
        // Приложение не использует вход/сессии (только публичный anon-ключ),
        // поэтому не храним и не обновляем токены — меньше «магии» в браузере.
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return client;
}

/**
 * Быстрая проверка соединения с Supabase.
 * Делает лёгкий запрос (count) к таблице certificates и возвращает результат
 * с понятным сообщением — используется кнопкой «Проверить Supabase».
 */
export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      message:
        "Supabase не настроен: задайте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в .env.local и перезапустите dev-сервер.",
    };
  }
  try {
    const { count, error } = await getSupabase()
      .from("certificates")
      .select("*", { count: "exact", head: true });
    if (error) {
      return { ok: false, message: `Ошибка Supabase: ${error.message}` };
    }
    return { ok: true, message: `Соединение с Supabase в порядке. Записей в реестре: ${count ?? 0}.` };
  } catch (e) {
    return { ok: false, message: `Не удалось подключиться к Supabase: ${(e as Error).message}` };
  }
}
