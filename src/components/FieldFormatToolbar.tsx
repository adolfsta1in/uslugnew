"use client";

import { useEffect, useState } from "react";
import { $getSelection, $isRangeSelection } from "lexical";
import { $patchStyleText, $getSelectionStyleValueForProperty } from "@lexical/selection";
import { getActiveEditor } from "../lib/activeEditor";

// ============================================================================
// Плавающая панель форматирования выделенного текста в полях бланка.
// Появляется, когда внутри поля выделен текст, и позволяет:
//   • менять размер шрифта (− / размер / +);
//   • задавать цвет шрифта: чёрный или белый.
// Работает с активным полем (см. lib/activeEditor).
// ============================================================================

const SIZES = [8, 9, 10, 10.5, 11, 11.5, 12, 13, 14, 16, 18, 20, 24, 28];
const DEFAULT_SIZE = "11.5pt";

function parsePt(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 11.5;
}

interface Pos {
  visible: boolean;
  top: number;
  left: number;
  size: string;
  color: string;
}

const HIDDEN: Pos = { visible: false, top: 0, left: 0, size: DEFAULT_SIZE, color: "" };

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
      const fieldEditor = el?.closest?.(".field-editor");
      if (!fieldEditor) {
        setPos((p) => (p.visible ? HIDDEN : p));
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      let size = DEFAULT_SIZE;
      let color = "";
      const editor = getActiveEditor();
      if (editor) {
        editor.getEditorState().read(() => {
          const s = $getSelection();
          if ($isRangeSelection(s)) {
            size = $getSelectionStyleValueForProperty(s, "font-size", DEFAULT_SIZE);
            color = $getSelectionStyleValueForProperty(s, "color", "");
          }
        });
      }
      const top = Math.max(6, rect.top - 44);
      const left = Math.min(
        window.innerWidth - 130,
        Math.max(130, rect.left + rect.width / 2)
      );
      setPos({ visible: true, top, left, size, color });
    };

    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  const apply = (styles: Record<string, string>, newSize?: string) => {
    const editor = getActiveEditor();
    if (!editor) return;
    editor.update(() => {
      const s = $getSelection();
      if ($isRangeSelection(s)) $patchStyleText(s, styles);
    });
    if (newSize) setPos((p) => ({ ...p, size: newSize }));
  };

  const stepSize = (dir: 1 | -1) => {
    const cur = parsePt(pos.size);
    let next: number;
    if (dir > 0) {
      next = SIZES.find((s) => s > cur) ?? SIZES[SIZES.length - 1];
    } else {
      const smaller = SIZES.filter((s) => s < cur);
      next = smaller.length ? smaller[smaller.length - 1] : SIZES[0];
    }
    apply({ "font-size": `${next}pt` }, `${next}pt`);
  };

  if (!pos.visible) return null;

  return (
    <div
      className="fmt-toolbar no-print"
      style={{ top: pos.top, left: pos.left }}
      // preventDefault на mousedown → поле не теряет фокус и выделение
      onMouseDown={(e) => e.preventDefault()}
    >
      <button className="fmt-btn" title="Меньше шрифт" onClick={() => stepSize(-1)}>
        A−
      </button>
      <span className="fmt-size">{parsePt(pos.size)}</span>
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
