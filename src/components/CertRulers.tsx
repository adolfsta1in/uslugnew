"use client";

import { useRef, useState } from "react";

// ============================================================================
// Линейки (горизонтальная сверху + вертикальная слева) как в Microsoft Word.
// Позволяют мышью двигать поля бланка: левое, правое (горизонтальная линейка)
// и верхнее (вертикальная). Значения — в миллиметрах, отдаются наружу через
// onChange и применяются к листу как CSS-переменные --cert-left/right/top.
//
// Точность: деления линейки размечены в CSS-единицах «mm/cm», поэтому всегда
// совпадают с листом (он тоже свёрстан в mm) при любом масштабе. Перевод
// «пиксели перетаскивания → мм» берётся из реального размера листа на экране.
// ============================================================================

export interface Margins {
  top: number; // мм — верхнее поле (старт текста)
  left: number; // мм — левое поле
  right: number; // мм — правое поле
}

const PAGE_W = 210; // мм (A4)
const PAGE_H = 297; // мм (A4)
const RULER = 26; // px — толщина линейки
const MIN_GAP = 25; // мм — минимальная ширина текстовой области / отступ снизу

type DragKind = "left" | "right" | "top";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

interface Props {
  margins: Margins;
  onChange: (m: Margins) => void;
  children: React.ReactNode; // лист A4
}

export default function CertRulers({ margins, onChange, children }: Props) {
  const pageRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ kind: DragKind; value: number } | null>(null);

  const startDrag = (kind: DragKind, e: React.PointerEvent) => {
    e.preventDefault();
    const page = pageRef.current;
    if (!page) return;
    const rect = page.getBoundingClientRect();
    const pxPerMmX = rect.width / PAGE_W;
    const pxPerMmY = rect.height / PAGE_H;
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...margins };

    const move = (ev: PointerEvent) => {
      let next = { ...start };
      if (kind === "left") {
        const v = clamp(
          start.left + (ev.clientX - startX) / pxPerMmX,
          0,
          PAGE_W - start.right - MIN_GAP
        );
        next = { ...start, left: Math.round(v) };
      } else if (kind === "right") {
        const v = clamp(
          start.right - (ev.clientX - startX) / pxPerMmX,
          0,
          PAGE_W - start.left - MIN_GAP
        );
        next = { ...start, right: Math.round(v) };
      } else {
        const v = clamp(
          start.top + (ev.clientY - startY) / pxPerMmY,
          0,
          PAGE_H - MIN_GAP
        );
        next = { ...start, top: Math.round(v) };
      }
      setDrag({ kind, value: kind === "left" ? next.left : kind === "right" ? next.right : next.top });
      onChange(next);
    };
    const up = () => {
      setDrag(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Деления: числа в сантиметрах (Word). Малые штрихи (мм) — фоновым градиентом.
  const hCm = Array.from({ length: Math.floor(PAGE_W / 10) + 1 }, (_, i) => i);
  const vCm = Array.from({ length: Math.floor(PAGE_H / 10) + 1 }, (_, i) => i);

  const textLeft = margins.left; // мм
  const textRight = PAGE_W - margins.right; // мм

  return (
    <div className="cert-rulers">
      {/* Уголок */}
      <div className="ruler-corner" style={{ width: RULER, height: RULER }} />

      {/* Горизонтальная линейка */}
      <div className="ruler ruler-h" style={{ height: RULER, width: `${PAGE_W}mm` }}>
        {/* затемнение полей (левое/правое) */}
        <div className="ruler-shade" style={{ left: 0, width: `${textLeft}mm` }} />
        <div className="ruler-shade" style={{ left: `${textRight}mm`, right: 0 }} />
        {/* мелкие штрихи (мм) */}
        <div className="ruler-ticks ruler-ticks-h" />
        {/* числа в см */}
        {hCm.map((c) => (
          <span key={c} className="ruler-num" style={{ left: `${c}cm` }}>
            {c}
          </span>
        ))}
        {/* маркеры полей */}
        <div
          className="ruler-handle ruler-handle-h"
          style={{ left: `${margins.left}mm` }}
          onPointerDown={(e) => startDrag("left", e)}
          title="Левое поле — потяните"
        >
          <span className="ruler-tri ruler-tri-down" />
        </div>
        <div
          className="ruler-handle ruler-handle-h"
          style={{ left: `${textRight}mm` }}
          onPointerDown={(e) => startDrag("right", e)}
          title="Правое поле — потяните"
        >
          <span className="ruler-tri ruler-tri-down" />
        </div>
      </div>

      {/* Вертикальная линейка */}
      <div className="ruler ruler-v" style={{ width: RULER, height: `${PAGE_H}mm` }}>
        <div className="ruler-shade-v" style={{ top: 0, height: `${margins.top}mm` }} />
        <div className="ruler-ticks ruler-ticks-v" />
        {vCm.map((c) => (
          <span key={c} className="ruler-num ruler-num-v" style={{ top: `${c}cm` }}>
            {c}
          </span>
        ))}
        <div
          className="ruler-handle ruler-handle-v"
          style={{ top: `${margins.top}mm` }}
          onPointerDown={(e) => startDrag("top", e)}
          title="Верхнее поле — потяните"
        >
          <span className="ruler-tri ruler-tri-right" />
        </div>
      </div>

      {/* Лист A4 */}
      <div className="ruler-page" ref={pageRef}>
        {children}
        {drag && (
          <div className="ruler-readout">
            {drag.kind === "left" && `Левое поле: ${drag.value} мм`}
            {drag.kind === "right" && `Правое поле: ${drag.value} мм`}
            {drag.kind === "top" && `Верхнее поле: ${drag.value} мм`}
          </div>
        )}
      </div>
    </div>
  );
}
