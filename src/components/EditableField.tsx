"use client";

import { useEffect } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  KEY_ENTER_COMMAND,
  FOCUS_COMMAND,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  type EditorState,
} from "lexical";
import { setActiveEditor } from "../lib/activeEditor";

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
