import { getSupabase } from "./supabaseClient";
import type { Certificate } from "./certificate";

const TABLE = "certificates";

// Поля, которые мы записываем в БД (без служебных id/created_at/updated_at —
// ими управляет Supabase). Держим здесь явный список, чтобы случайно не отправить
// вычисляемые/лишние поля.
const WRITABLE_KEYS: (keyof Certificate)[] = [
  "cert_number",
  "from_day",
  "from_month",
  "from_year",
  "to_day",
  "to_month",
  "to_year",
  "service_name",
  "address",
  "manager_name",
  "service_type",
  "normative_doc",
  "basis_date_number",
  "activity_doc",
  "inspection_body",
  "special_notes",
  "signatory",
  "signature",
  "certificate_number",
  "application_number",
  "plan_number",
  "inspector",
  "amount",
];

function pickWritable(c: Partial<Certificate>): Partial<Certificate> {
  const out: Partial<Certificate> = {};
  for (const key of WRITABLE_KEYS) {
    if (key in c) {
      // @ts-expect-error — динамическое присваивание по ключу
      out[key] = c[key];
    }
  }
  return out;
}

/** Загрузить все сертификаты (новые сверху). */
export async function listCertificates(): Promise<Certificate[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Certificate[];
}

/** Загрузить один сертификат по id. */
export async function getCertificate(id: string): Promise<Certificate | null> {
  const { data, error } = await getSupabase().from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Certificate) ?? null;
}

/** Создать новую запись. Возвращает сохранённую запись (с id/created_at). */
export async function insertCertificate(c: Certificate): Promise<Certificate> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .insert(pickWritable(c))
    .select()
    .single();
  if (error) throw error;
  return data as Certificate;
}

/** Обновить существующую запись по id. */
export async function updateCertificate(id: string, patch: Partial<Certificate>): Promise<Certificate> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .update(pickWritable(patch))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Certificate;
}

/** Удалить запись по id. */
export async function deleteCertificate(id: string): Promise<void> {
  const { error } = await getSupabase().from(TABLE).delete().eq("id", id);
  if (error) throw error;
}
