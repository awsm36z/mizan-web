"use client";

// The compose row: text input + Send + a microphone button using the
// browser's own Web Speech API — ported from the HTML prototype's
// setupVoiceInput(). Speech-to-text only (dictate, then review before
// sending); no text-to-speech output. The mic button stays hidden rather
// than shown-and-broken when SpeechRecognition isn't available in this
// browser/context (feature-detected once on mount).

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/types";
import { t } from "@/lib/i18n";

function langToSpeechLocale(lang: Lang): string {
  if (lang === "fr") return "fr-FR";
  if (lang === "ar" || lang === "dar") return "ar-MA";
  return "en-US";
}

// Minimal shape of the Web Speech API surface this component uses — no
// @types/dom-speech-recognition dependency, and both vendor-prefixed and
// standard globals are optional (most browsers still don't ship this).
interface MinimalSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function ComposeBar({
  lang,
  onSend,
  disabled,
}: {
  lang: Lang;
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const w = window as any;
    const Impl = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Impl) return;
    const recognition: MinimalSpeechRecognition = new Impl();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript as string;
      setValue(transcript);
      inputRef.current?.focus();
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setMicSupported(true);
  }, []);

  function handleSend() {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue("");
  }

  function toggleMic() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      return;
    }
    try {
      recognition.lang = langToSpeechLocale(lang);
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  return (
    <div className="compose-row">
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        value={value}
        placeholder={t(lang, "composePlaceholder")}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSend();
        }}
      />
      {micSupported && (
        <button
          type="button"
          className={"mic-btn" + (listening ? " listening" : "")}
          aria-label={t(lang, listening ? "micAriaListening" : "micAriaIdle")}
          onClick={toggleMic}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>
      )}
      <button type="button" className="send" disabled={disabled} onClick={handleSend}>
        {t(lang, "send")}
      </button>
    </div>
  );
}
