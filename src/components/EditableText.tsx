"use client";

import { useEffect, useRef } from "react";
import { getTemplateText, setTemplateText } from "../lib/templateStore";

interface EditableTextProps {
  /** Уникальный id фрагмента шаблона (для сохранения правок). */
  id: string;
  /** Текст по умолчанию. */
  defaultText: string;
}

/**
 * Редактируемый постоянный текст сертификата (contentEditable).
 * Неуправляемый: начальный текст ставится один раз через ref, чтобы не сбивать
 * курсор при вводе. Правки сохраняются в templateStore.
 */
export default function EditableText({ id, defaultText }: EditableTextProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = getTemplateText(id, defaultText);
    }
  }, [id, defaultText]);

  return (
    <span
      ref={ref}
      className="const-text"
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onInput={(e) => setTemplateText(id, e.currentTarget.textContent ?? "")}
    />
  );
}
