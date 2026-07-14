"use client";

import { useEffect, useState } from "react";
import { $getSelection, $isRangeSelection } from "lexical";
import { $patchStyleText, $getSelectionStyleValueForProperty } from "@lexical/selection";
import { getActiveEditor } from "../lib/activeEditor";
import { setTemplateText } from "../lib/templateStore";

// ============================================================================
// Плавающая панель форматирования выделенного текста.
// Работает и для полей бланка (Lexical), и для постоянного текста шаблона
// (обычный contentEditable). Позволяет:
//   • менять размер шрифта (− / размер / +);
//   • задавать цвет шрифта: чёрный или белый;
//   • сбрасывать формат.
// Для постоянного текста форматирование сохраняется (см. EditableText).
// ============================================================================

// Размер шрифта регулируется непрерывно (шаг 0.5 pt) в широком диапазоне —
// чтобы было «много пунктов», а не короткий фиксированный список.
const MIN_SIZE = 6;
const MAX_SIZE = 96;
const SIZE_STEP = 0.5;
const DEFAULT_SIZE = "11.5pt";
const BASE_COLOR = "#000000";

type Mode = "lexical" | "native";

function parsePt(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 11.5;
}

/** Ограничить размер диапазоном и округлить до 0.5 pt. */
function clampSize(n: number): number {
  const rounded = Math.round(n * 2) / 2;
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, rounded));
}

interface Pos {
  visible: boolean;
  mode: Mode;
  top: number;
  left: number;
  size: string;
}

const HIDDEN: Pos = { visible: false, mode: "lexical", top: 0, left: 0, size: DEFAULT_SIZE };

/** Применить стиль к выделению в обычном contentEditable (постоянный текст). */
function applyNativeStyle(styles: Record<string, string>) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const startEl = container.nodeType === 3 ? container.parentElement : (container as Element);
  const host = startEl?.closest(".const-text") as HTMLElement | null;
  if (!host) return;

  const span = document.createElement("span");
  for (const [k, v] of Object.entries(styles)) {
    const val = v === "" ? (k === "color" ? BASE_COLOR : DEFAULT_SIZE) : v;
    span.style.setProperty(k, val);
  }
  try {
    range.surroundContents(span);
  } catch {
    const frag = range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);
  }
  // Переустановить выделение на содержимое нового span.
  sel.removeAllRanges();
  const nr = document.createRange();
  nr.selectNodeContents(span);
  sel.addRange(nr);

  const tid = host.getAttribute("data-tid");
  if (tid) setTemplateText(tid, host.innerHTML);
}

export default function FieldFormatToolbar() {
  const [pos, setPos] = useState<Pos>(HIDDEN);

  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setPos((p) => (p.visible ? HIDDEN : p));
        return;
      }
      const anchor = sel.anchorNode;
      const el =
        anchor && (anchor.nodeType === 3 ? anchor.parentElement : (anchor as Element));
      const lex = el?.closest?.(".field-editor");
      const ct = el?.closest?.(".const-text");
      if (!lex && !ct) {
        setPos((p) => (p.visible ? HIDDEN : p));
        return;
      }
      const mode: Mode = lex ? "lexical" : "native";
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      let size = DEFAULT_SIZE;

      if (mode === "lexical") {
        const editor = getActiveEditor();
        if (editor) {
          editor.getEditorState().read(() => {
            const s = $getSelection();
            if ($isRangeSelection(s)) {
              size = $getSelectionStyleValueForProperty(s, "font-size", DEFAULT_SIZE);
            }
          });
        }
      } else if (el) {
        const px = parseFloat(getComputedStyle(el).fontSize);
        if (Number.isFinite(px)) size = `${(px * 72) / 96}pt`;
      }

      const top = Math.max(6, rect.top - 44);
      const left = Math.min(window.innerWidth - 130, Math.max(130, rect.left + rect.width / 2));
      setPos({ visible: true, mode, top, left, size });
    };

    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  const apply = (styles: Record<string, string>, newSize?: string) => {
    if (pos.mode === "native") {
      applyNativeStyle(styles);
    } else {
      const editor = getActiveEditor();
      if (!editor) return;
      editor.update(() => {
        const s = $getSelection();
        if ($isRangeSelection(s)) $patchStyleText(s, styles);
      });
    }
    if (newSize) setPos((p) => ({ ...p, size: newSize }));
  };

  const setSize = (n: number) => {
    const next = clampSize(n);
    apply({ "font-size": `${next}pt` }, `${next}pt`);
  };

  const stepSize = (dir: 1 | -1) => {
    setSize(parsePt(pos.size) + dir * SIZE_STEP);
  };

  if (!pos.visible) return null;

  return (
    <div
      className="fmt-toolbar no-print"
      style={{ top: pos.top, left: pos.left }}
      // preventDefault на mousedown → редактор не теряет фокус и выделение
      onMouseDown={(e) => e.preventDefault()}
    >
      <button className="fmt-btn" title="Меньше шрифт" onClick={() => stepSize(-1)}>
        A−
      </button>
      <span className="fmt-size">{Math.round(parsePt(pos.size) * 10) / 10}</span>
      <button className="fmt-btn" title="Больше шрифт" onClick={() => stepSize(1)}>
        A+
      </button>
      <span className="fmt-sep" />
      <button
        className="fmt-swatch"
        title="Чёрный шрифт"
        style={{ background: "#000" }}
        onClick={() => apply({ color: "#000000" })}
      />
      <button
        className="fmt-swatch fmt-swatch-white"
        title="Белый шрифт"
        style={{ background: "#fff" }}
        onClick={() => apply({ color: "#ffffff" })}
      />
      <span className="fmt-sep" />
      <button
        className="fmt-btn"
        title="Сбросить формат"
        onClick={() => apply({ color: "", "font-size": "" }, DEFAULT_SIZE)}
      >
        ⟲
      </button>
    </div>
  );
}
