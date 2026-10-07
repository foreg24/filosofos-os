"use client";

import { forwardRef } from "react";
import type { PromptInfo } from "@/types/terminal";
import type { InputMode } from "@/lib/terminal/terminalState";
import { TerminalCursor } from "./TerminalCursor";
import { Prompt } from "./TerminalLine";

export interface TerminalKeyHandlers {
  onSubmit: () => void;
  onHistory: (direction: -1 | 1) => void;
  onComplete: () => boolean;
  onClearScreen: () => void;
  onInterrupt: () => boolean;
  /** Ctrl+Z: detiene el proceso en primer plano. */
  onSuspend: () => boolean;
  onEof: () => void;
}

interface TerminalInputProps extends TerminalKeyHandlers {
  mode: InputMode;
  prompt: PromptInfo;
  passwordPrompt: string | null;
  value: string;
  caret: number;
  focused: boolean;
  /** Pista discreta tras el cursor mientras la línea está vacía (p. ej. "escribe help"). */
  hint?: string | null;
  onValue: (value: string, caret: number) => void;
  onCaret: (caret: number) => void;
  onFocusChange: (focused: boolean) => void;
}

/**
 * Línea de entrada: un <input> real e invisible recibe teclado, pegado y teclado móvil;
 * encima se dibuja el prompt, el texto y el cursor de bloque.
 */
export const TerminalInput = forwardRef<HTMLInputElement, TerminalInputProps>(function TerminalInput(props, ref) {
  const { mode, prompt, passwordPrompt, value, caret, focused, hint, onValue, onCaret, onFocusChange } = props;
  const secret = mode === "password";

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const key = e.key;
    const ctrl = e.ctrlKey && !e.metaKey && !e.altKey;
    if (key === "Enter") {
      e.preventDefault();
      props.onSubmit();
    } else if (key === "ArrowUp" || key === "ArrowDown") {
      e.preventDefault();
      if (!secret) props.onHistory(key === "ArrowUp" ? -1 : 1);
    } else if (key === "Tab" && !e.shiftKey && !secret) {
      // Con la línea vacía, Tab sigue moviendo el foco (no atrapa la navegación por teclado).
      if (props.onComplete()) e.preventDefault();
    } else if (key === "Escape") {
      e.currentTarget.blur();
    } else if (ctrl && key.toLowerCase() === "l") {
      e.preventDefault();
      props.onClearScreen();
    } else if (ctrl && key.toLowerCase() === "c") {
      // Con texto seleccionado, Ctrl+C copia; sin selección, interrumpe.
      if (!window.getSelection()?.toString() && props.onInterrupt()) e.preventDefault();
    } else if (ctrl && key.toLowerCase() === "z") {
      if (props.onSuspend()) e.preventDefault();
    } else if (ctrl && key.toLowerCase() === "d" && !value) {
      e.preventDefault();
      props.onEof();
    } else if (ctrl && key.toLowerCase() === "u" && !secret) {
      e.preventDefault();
      onValue(value.slice(caret), 0);
    }
  };

  const syncCaret = (e: React.SyntheticEvent<HTMLInputElement>) => onCaret(e.currentTarget.selectionStart ?? value.length);

  const busy = mode === "busy";

  return (
    // Mientras un proceso corre no hay prompt, pero el input sigue enfocado para recibir Ctrl+C.
    <div className="term-line relative" style={busy ? { minHeight: 0, height: 0, overflow: "hidden" } : undefined}>
      {!busy && (
        <>
          {secret ? <span>{passwordPrompt}</span> : <><Prompt prompt={prompt} /> </>}
          {!secret && value.slice(0, caret)}
          <TerminalCursor char={secret ? " " : value[caret]} focused={focused} />
          {!secret && value.slice(caret + 1)}
          {!secret && !value && hint && (
            <span aria-hidden className="term-hint">
              {hint}
            </span>
          )}
        </>
      )}
      <input
        ref={ref}
        className="term-hidden-input"
        type="text"
        value={secret ? "" : value}
        onChange={(e) => {
          if (secret) return; // la contraseña nunca se guarda
          onValue(e.target.value.replace(/\r?\n/g, " "), e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={syncCaret}
        onSelect={syncCaret}
        onFocus={() => onFocusChange(true)}
        onBlur={() => onFocusChange(false)}
        aria-label={secret ? "Contraseña" : "Comando de la terminal Debian"}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="send"
      />
    </div>
  );
});
