"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import EditableField from "./EditableField";
import { toast } from "./Toast";
import {
  Certificate,
  DEFAULT_CERT,
  emptyCertificate,
  EXTRA_FIELDS,
} from "../lib/certificate";
import {
  getCertificate,
  insertCertificate,
  updateCertificate,
} from "../lib/certificateStore";
import { isSupabaseConfigured } from "../lib/supabaseClient";

const DRAFT_KEY = "cert-draft-v1";

export default function CertificateEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");

  const [cert, setCert] = useState<Certificate>(DEFAULT_CERT);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0); // меняется → поля Lexical перемонтируются
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const didInit = useRef(false);

  // Поле-хелпер: значение берётся один раз при монтировании (Lexical неуправляем),
  // поэтому при загрузке/очистке меняем formKey, чтобы поля пересоздались.
  const setField = useCallback((key: keyof Certificate, value: string) => {
    setCert((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const loadRecord = useCallback(async (id: string) => {
    try {
      const rec = await getCertificate(id);
      if (rec) {
        setCert(rec);
        setRecordId(rec.id ?? id);
        setFormKey((k) => k + 1);
        setDirty(false);
        toast("Запись загружена из реестра", "info");
      } else {
        toast("Запись не найдена", "error");
      }
    } catch (e) {
      toast("Ошибка загрузки: " + (e as Error).message, "error");
    }
  }, []);

  // Инициализация: загрузить запись по id или восстановить черновик.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    if (idParam) {
      loadRecord(idParam);
      return;
    }
    // Восстановление черновика
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Certificate;
        setCert(draft);
        setFormKey((k) => k + 1);
      }
    } catch {
      /* ignore */
    }
  }, [idParam, loadRecord]);

  // Автосохранение черновика (защита от случайной потери данных).
  useEffect(() => {
    if (!didInit.current) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(cert));
    } catch {
      /* ignore */
    }
  }, [cert]);

  // Предупреждение при уходе со страницы с несохранёнными изменениями.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const handleSave = async () => {
    if (!isSupabaseConfigured) {
      toast("Supabase не настроен — задайте переменные окружения (.env.local)", "error");
      return;
    }
    setSaving(true);
    try {
      if (recordId) {
        await updateCertificate(recordId, cert);
        toast("Изменения сохранены в реестр", "success");
      } else {
        const saved = await insertCertificate(cert);
        setRecordId(saved.id ?? null);
        if (saved.id) {
          // Обновляем URL, чтобы перезагрузка сохраняла контекст записи
          router.replace(`/new?id=${saved.id}`);
        }
        toast("Сертификат сохранён в реестр", "success");
      }
      setDirty(false);
    } catch (e) {
      toast("Ошибка сохранения: " + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClear = () => {
    if (dirty && !window.confirm("Очистить форму? Несохранённые данные будут потеряны.")) {
      return;
    }
    setCert(emptyCertificate());
    setRecordId(null);
    setFormKey((k) => k + 1);
    setDirty(false);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    router.replace("/new");
  };

  const handleLoadFromRegistry = () => {
    router.push("/registry");
  };

  // Хелпер для рендера редактируемого поля бланка
  const f = (
    key: keyof Certificate,
    opts?: {
      hint?: string;
      width?: string;
      center?: boolean;
      multiline?: boolean;
      block?: boolean;
      plain?: boolean;
    }
  ) => (
    <EditableField
      key={`${formKey}-${key}`}
      value={String(cert[key] ?? "")}
      onChange={(t) => setField(key, t)}
      hint={opts?.hint}
      width={opts?.width}
      center={opts?.center}
      multiline={opts?.multiline}
      block={opts?.block}
      plain={opts?.plain}
    />
  );

  return (
    <div style={{ padding: "20px 12px 60px" }}>
      {/* Панель действий */}
      <div
        className="editor-toolbar no-print"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",
          marginBottom: 16,
          position: "sticky",
          top: 52,
          zIndex: 10,
          background: "var(--bg)",
          padding: "8px 0",
        }}
      >
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Сохранение…" : recordId ? "💾 Сохранить изменения" : "💾 Сохранить в реестр"}
        </button>
        <button className="btn" onClick={handlePrint}>🖨️ Печать сертификата</button>
        <button className="btn" onClick={handleClear}>🧹 Очистить форму</button>
        <button className="btn" onClick={handleLoadFromRegistry}>📂 Загрузить из реестра</button>
      </div>

      {/* ===== Лист A4 ===== */}
      <div className="a4-page">
        <div className="a4-header-guide no-print">
          Область готового бланка (шапка, логотипы, номер) — НЕ печатается приложением
        </div>

        <div className="cert-content">
          {/* Срок действия */}
          <div className="cert-validity">
            Эътибор дорад&nbsp;&nbsp;&nbsp; аз «{f("from_day", { width: "12mm", center: true, hint: "дд" })}»{" "}
            {f("from_month", { width: "22mm", center: true, hint: "месяц" })}{" "}
            {f("from_year", { width: "16mm", center: true, hint: "год" })} с.
          </div>
          <div className="cert-validity-row">
            <span className="left">
              №{f("cert_number", { width: "60mm", hint: "№ свидетельства", plain: true })}
            </span>
            <span>
              то «{f("to_day", { width: "12mm", center: true, hint: "дд" })}»{" "}
              {f("to_month", { width: "22mm", center: true, hint: "месяц" })}{" "}
              {f("to_year", { width: "16mm", center: true, hint: "год" })} с.
            </span>
          </div>

          {/* Основной текст */}
          <div className="cpar" style={{ marginTop: "3mm" }}>
            Шаҳодатномаи мазкур тасдиқ менамояд, ки хизматрасонии{" "}
            {f("service_name", { width: "70mm", hint: "наименование" })}
          </div>
          {f("address", { block: true, center: true, hint: "адрес объекта" })}
          <p className="cert-caption">(номгӯи муассисаи иҷрокунандаи хизматрасонӣ)</p>

          {f("manager_name", { block: true, center: true, hint: "ФИО руководителя" })}
          <p className="cert-caption">(ному насаби роҳбари ташкилот)</p>

          <div className="cert-indent cpar">
            дар асоси Қонунҳои Ҷумҳурии Тоҷикистон «Дар бораи баҳодиҳии мутобиқат», «Дар бораи
            ҳимояи ҳуқуқи истеъмолкунандагон», «Дар бораи бамеъёрдарории техникӣ», «Дар бораи
            стандартонӣ», «Дар бораи таъмини ченаки ягона», «Дар бораи савдо ва хизматрасонии
            маишӣ», «Дар бораи бехатарии маҳсулоти хӯрокворӣ» аз ҷониби Тоҷикстандарт баҳогузорӣ
            карда шуда, субъекти хоҷагидори мазкур имконияти иҷрои хизматрасонии{" "}
            {f("service_type", { width: "55mm", hint: "вид услуги" })}
          </div>
          <p className="cert-caption">(номгӯи кору хизматрасонӣ)</p>

          <div className="cpar">
            мутобиқи талаботи {f("normative_doc", { width: "55mm", hint: "нормативный документ" })}{" "}
            дорад.
          </div>
          <p className="cert-caption">(ифодаи номгӯи ҳуҷҷатҳои меъёрии техникӣ)</p>

          <div className="cert-indent cpar">
            Шаҳодатнома дода шуд дар асоси хулосаи (тасдиқнома) баҳогузорӣ оид ба тасдиқи мутобиқати
            хизматрасонии субъекти хоҷагидор ба талаботи ҳуҷҷати меъёрии техникӣ аз{" "}
            {f("basis_date_number", { width: "50mm", hint: "дата и № основания" })}. Ҳангоми
            шаҳодатномадиҳӣ ҳуҷҷати муайянкунандаи ҳуқуқи фаъолияти субъекти хоҷагидор{" "}
            {f("activity_doc", { width: "55mm", hint: "документ" })} ба инобат гирифта шуд.
          </div>

          <p className="cert-indent cpar">
            Дархосткунанда, (иҷрокунандаи кор ва хизматрасонӣ) барои мутобиқати кору ё хизматрасонии
            ба талаботи муқаррарнамудаи ҳуҷҷати меъёрии техникие, ки дар шаҳодатнома дарҷ гардидааст
            ва огоҳ намудани истеъмолкунанда дар бобати доштани шаҳодатнома масъул мебошад.
          </p>

          <div className="cpar">
            Назорати инспексионӣ аз ҷониби{" "}
            {f("inspection_body", { width: "45mm", hint: "орган" })} амалӣ карда мешавад.
          </div>
          <p className="cert-caption">(номгӯи мақомот оид ба шаҳодатномадиҳӣ)</p>

          <div className="cpar">
            Қайдҳои махсус {f("special_notes", { width: "90mm", hint: "особые отметки" })}
          </div>

          <p className="cert-indent cpar" style={{ marginTop: "1mm" }}>
            Дар ҳолати иҷро накардани талаботи муқарраргардида шаҳодатномаи мазкур аз эътибор соқит
            дониста мешавад.
          </p>

          {/* Подпись */}
          <div className="cert-sign">
            <p className="cert-sign-right">Роҳбари мақомот</p>
            <div className="cert-validity-row" style={{ marginTop: "3mm" }}>
              <span className="left">Ҷ.М.</span>
              <span>_______________</span>
              <span>{f("signatory", { width: "45mm", center: true, hint: "ФИО" })}</span>
            </div>
            <div className="cert-validity-row" style={{ fontSize: "8.5pt", marginTop: "-1mm" }}>
              <span className="left">&nbsp;</span>
              <span>(имзо)</span>
              <span style={{ width: "45mm", textAlign: "center" }}>(ному насаб)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Дополнительные данные (в реестр, НЕ печатаются) ===== */}
      <div
        className="extra-panel no-print"
        style={{
          maxWidth: "210mm",
          margin: "20px auto 0",
          background: "#fff",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 16,
        }}
      >
        <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Дополнительные данные</h3>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted)" }}>
          Эти поля сохраняются в реестр, но не печатаются на бланке.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {EXTRA_FIELDS.map((ef) => (
            <label key={ef.key} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <span style={{ color: "var(--muted)" }}>{ef.label}</span>
              <input
                type={ef.numeric ? "number" : "text"}
                value={
                  ef.numeric
                    ? cert.amount ?? ""
                    : (cert[ef.key] as string) ?? ""
                }
                onChange={(e) => {
                  if (ef.numeric) {
                    const v = e.target.value;
                    setCert((prev) => ({ ...prev, amount: v === "" ? null : Number(v) }));
                  } else {
                    setCert((prev) => ({ ...prev, [ef.key]: e.target.value }));
                  }
                  setDirty(true);
                }}
                style={{
                  padding: "8px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
