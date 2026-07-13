"use client";

import { useEffect, useRef } from "react";
import { getTemplateText, setTemplateText, hasTemplateText } from "../lib/templateStore";

interface EditableTextProps {
  /** Уникальный id фрагмента шаблона (для сохранения правок). */
  id: string;
  /** Текст по умолчанию. */
  defaultText: string;
}

/**
 * Редактируемый постоянный текст сертификата (contentEditable).
 * Неуправляемый: начальное содержимое ставится один раз через ref, чтобы не
 * сбивать курсор при вводе. Правки (включая форматирование — цвет/размер,
 * применяемые панелью) сохраняются в templateStore как HTML, поэтому последняя
 * версия остаётся такой же при перезагрузке.
 */
export default function EditableText({ id, defaultText }: EditableTextProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (hasTemplateText(id)) {
      // Сохранённая правка может содержать форматирование → ставим как HTML.
      ref.current.innerHTML = getTemplateText(id, defaultText);
    } else {
      ref.current.textContent = defaultText;
    }
  }, [id, defaultText]);

  return (
    <span
      ref={ref}
      className="const-text"
      data-tid={id}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onInput={(e) => setTemplateText(id, e.currentTarget.innerHTML)}
    />
  );
}
