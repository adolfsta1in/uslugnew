"use client";

import { useEffect, useRef } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $getNodeByKey,
  $createParagraphNode,
  $createTextNode,
  KEY_ENTER_COMMAND,
  FOCUS_COMMAND,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  type EditorState,
} from "lexical";
import { setActiveEditor } from "../lib/activeEditor";

/** Пара автозамены: короткая форма → полная. */
export interface AbbrPair {
  short: string;
  full: string;
}

interface EditableFieldProps {
  /** Начальное значение (устанавливается один раз при монтировании). */
  value: string;
  /** Вызывается при каждом изменении текста. */
  onChange: (text: string) => void;
  /** Подсказка, пока поле пустое. */
  hint?: string;
  /** Ширина поля (CSS, напр. "40mm"). */
  width?: string;
  /** Разрешить перенос строк (для многострочных полей). */
  multiline?: boolean;
  /** Выравнивание текста по центру. */
  center?: boolean;
  /** Блочное (на всю ширину) поле вместо inline. */
  block?: boolean;
  /** Без подчёркивания и подсветки (для предзаполненных полей, напр. № свидетельства). */
  plain?: boolean;
  /** Список автозамен (сокращений), применяемых при вводе. */
  abbr?: AbbrPair[];
}

/** Заполняет пустой редактор начальным текстом ровно один раз. */
function prepopulate(text: string) {
  return () => {
    const root = $getRoot();
    if (root.getFirstChild() === null) {
      const p = $createParagraphNode();
      if (text) p.append($createTextNode(text));
      root.append(p);
    }
  };
}

/** Блокирует Enter в однострочных полях, чтобы не ломать вёрстку. */
function SingleLinePlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent | null) => {
        event?.preventDefault();
        return true; // «съедаем» Enter
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor]);
  return null;
}

/** Регистрирует поле как «активное» при фокусе — для панели форматирования. */
function ActiveEditorPlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return editor.registerCommand(
      FOCUS_COMMAND,
      () => {
        setActiveEditor(editor);
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor]);
  return null;
}

/**
 * Автозамена сокращений: при нажатии пробела слово перед курсором заменяется
 * на полную форму, если оно совпадает с одним из заданных сокращений.
 */
function AutocorrectPlugin({ pairs }: { pairs: AbbrPair[] }) {
  const [editor] = useLexicalComposerContext();
  const mapRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const m = new Map<string, string>();
    for (const p of pairs) if (p.short) m.set(p.short, p.full);
    mapRef.current = m;
  }, [pairs]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== " " || mapRef.current.size === 0) return;
      const info = editor.getEditorState().read(() => {
        const sel = $getSelection();
        if (!$isRangeSelection(sel) || !sel.isCollapsed()) return null;
        const node = sel.anchor.getNode();
        if (!$isTextNode(node)) return null;
        const offset = sel.anchor.offset;
        const before = node.getTextContent().slice(0, offset);
        const match = before.match(/(\S+)$/);
        if (!match) return null;
        const full = mapRef.current.get(match[1]);
        if (full == null) return null;
        return { key: node.getKey(), start: offset - match[1].length, end: offset, full };
      });
      if (!info) return;
      e.preventDefault(); // сами вставим полную форму + пробел
      editor.update(() => {
        const node = $getNodeByKey(info.key);
        if (!$isTextNode(node)) return;
        const t = node.getTextContent();
        node.setTextContent(t.slice(0, info.start) + info.full + " " + t.slice(info.end));
        const caret = info.start + info.full.length + 1;
        node.select(caret, caret);
      });
    };

    return editor.registerRootListener((root, prevRoot) => {
      if (prevRoot) prevRoot.removeEventListener("keydown", onKeyDown);
      if (root) root.addEventListener("keydown", onKeyDown);
    });
  }, [editor]);

  return null;
}

/**
 * Одно редактируемое поле сертификата на базе Lexical (rich text editor).
 * Каждое поле — изолированный экземпляр редактора, поэтому постоянный текст
 * бланка остаётся нередактируемым, а пользователь заполняет только эти места.
 */
export default function EditableField({
  value,
  onChange,
  hint,
  width,
  multiline = false,
  center = false,
  block = false,
  plain = false,
  abbr,
}: EditableFieldProps) {
  const initialConfig = {
    namespace: "cert-field",
    editable: true,
    editorState: prepopulate(value),
    onError: (error: Error) => {
      // Ошибки редактора не должны ронять всю страницу
      console.error("Lexical error:", error);
    },
    theme: {},
  };

  const classNames = [
    "field",
    "field-inline",
    center ? "field-center" : "",
    multiline ? "field-multiline" : "",
    block ? "field-block" : "",
    plain ? "field-plain" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classNames} style={width ? { minWidth: width } : undefined}>
      <LexicalComposer initialConfig={initialConfig}>
        <RichTextPlugin
          contentEditable={<ContentEditable className="field-editor" />}
          placeholder={hint ? <span className="field-placeholder">{hint}</span> : null}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ActiveEditorPlugin />
        {abbr && abbr.length > 0 && <AutocorrectPlugin pairs={abbr} />}
        {!multiline && <SingleLinePlugin />}
        <OnChangePlugin
          ignoreSelectionChange
          onChange={(editorState: EditorState) => {
            editorState.read(() => {
              onChange($getRoot().getTextContent());
            });
          }}
        />
      </LexicalComposer>
    </span>
  );
}
