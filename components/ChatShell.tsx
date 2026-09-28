"use client";

// Top-level chat orchestrator — ported from the HTML prototype's top-level
// state object + onSend/onConfirm/onWantsCorrection/resetChat functions,
// wired here to POST /api/chat/turn instead of running extractDraft /
// computeShares directly in the browser (see that route's header comment
// for the structural confirm-before-compute gate it enforces).

import { useEffect, useRef, useState } from "react";
import type { ChatTurnResponse, ComputeResult, HeirDraft, Lang } from "@/lib/types";
import { EMPTY_DRAFT } from "@/lib/types";
import { DEMO_BODY, STARTER_PHRASES, t } from "@/lib/i18n";
import { useLang } from "./LangProvider";
import { LangSwitch } from "./LangSwitch";
import { ComposeBar } from "./ComposeBar";
import { ConfirmationCard } from "./ConfirmationCard";
import { ComputedCard } from "./ComputedCard";
import { PricingGateModal } from "./PricingGateModal";
import { DocumentOverlay } from "./DocumentOverlay";

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; kind: "text"; text: string }
  | { id: string; role: "assistant"; kind: "confirmation"; text: string; draft: HeirDraft }
  | { id: string; role: "assistant"; kind: "computed"; result: ComputeResult; explanationText?: string };

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function postTurn(payload: {
  lang: Lang;
  message: string;
  draft: HeirDraft;
  stage: "collecting" | "awaiting_confirmation";
  userAction?: "confirm" | "correct";
}): Promise<ChatTurnResponse> {
  const res = await fetch("/api/chat/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`chat/turn failed: ${res.status}`);
  return res.json();
}

export function ChatShell() {
  const { lang } = useLang();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<HeirDraft>(EMPTY_DRAFT);
  const [stage, setStage] = useState<"collecting" | "awaiting_confirmation">("collecting");
  const [pendingConfirmationId, setPendingConfirmationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pricingGateFor, setPricingGateFor] = useState<ComputeResult | null>(null);
  const [documentFor, setDocumentFor] = useState<ComputeResult | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  function resetChat() {
    setMessages([{ id: newId(), role: "assistant", kind: "text", text: t(lang, "firstAssistant") }]);
    setDraft(EMPTY_DRAFT);
    setStage("collecting");
    setPendingConfirmationId(null);
  }

  // Switching language resets the conversation, exactly like the source's
  // langSwitch click handler (renderStaticText(); resetChat();) — the
  // demo never tries to translate an in-progress conversation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    resetChat();
  }, [lang]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  function applyResponse(response: ChatTurnResponse) {
    setDraft(response.draft);
    if (response.stage === "computed" && response.result) {
      setStage("collecting");
      setPendingConfirmationId(null);
      setMessages((m) => [
        ...m,
        { id: newId(), role: "assistant", kind: "computed", result: response.result!, explanationText: response.assistantText },
      ]);
    } else if (response.stage === "awaiting_confirmation") {
      setStage("awaiting_confirmation");
      const id = newId();
      setPendingConfirmationId(id);
      setMessages((m) => [
        ...m,
        { id, role: "assistant", kind: "confirmation", text: response.assistantText || "", draft: response.draft },
      ]);
    } else {
      setStage("collecting");
      setPendingConfirmationId(null);
      setMessages((m) => [...m, { id: newId(), role: "assistant", kind: "text", text: response.assistantText || "" }]);
    }
  }

  async function handleSend(text: string) {
    setMessages((m) => [...m, { id: newId(), role: "user", text }]);
    setBusy(true);
    try {
      const response = await postTurn({
        lang,
        message: text,
        draft,
        stage,
        userAction: stage === "awaiting_confirmation" ? "correct" : undefined,
      });
      applyResponse(response);
    } catch {
      setMessages((m) => [...m, { id: newId(), role: "assistant", kind: "text", text: t(lang, "computeErrorEmpty") }]);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(cardDraft: HeirDraft) {
    setBusy(true);
    try {
      const response = await postTurn({ lang, message: "", draft: cardDraft, stage: "awaiting_confirmation", userAction: "confirm" });
      applyResponse(response);
    } catch {
      setMessages((m) => [...m, { id: newId(), role: "assistant", kind: "text", text: t(lang, "computeErrorEmpty") }]);
    } finally {
      setBusy(false);
    }
  }

  function handleCorrect() {
    // Local-only, same as the source's onWantsCorrection(): prompts for
    // what to change, then the very next sent message merges onto the
    // still-pending draft via userAction: "correct" (see handleSend).
    setMessages((m) => [...m, { id: newId(), role: "assistant", kind: "text", text: t(lang, "correctPrompt") }]);
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="mark">م</div>
          <div>
            <h1>Mizan</h1>
            <div className="sub">{t(lang, "brandSub")}</div>
          </div>
        </div>
        <LangSwitch />
      </header>

      <div className="disclaimer">{t(lang, "disclaimer")}</div>

      <details className="demo-note">
        <summary>{t(lang, "demoSummary")}</summary>
        <ul>
          {DEMO_BODY[lang].map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </details>

      <main className="chat" ref={logRef}>
        {messages.map((msg) => {
          if (msg.role === "user") {
            return (
              <div className="msg user" key={msg.id}>
                <div className="bubble">{msg.text}</div>
              </div>
            );
          }
          if (msg.kind === "confirmation") {
            return (
              <div className="msg assistant" key={msg.id}>
                <ConfirmationCard
                  lang={lang}
                  text={msg.text}
                  disabled={busy || msg.id !== pendingConfirmationId}
                  onConfirm={() => handleConfirm(msg.draft)}
                  onCorrect={handleCorrect}
                />
              </div>
            );
          }
          if (msg.kind === "computed") {
            return (
              <div className="msg assistant" key={msg.id}>
                <ComputedCard
                  lang={lang}
                  result={msg.result}
                  explanationText={msg.explanationText}
                  onGenerateDocument={() => setPricingGateFor(msg.result)}
                />
              </div>
            );
          }
          return (
            <div className="msg assistant" key={msg.id}>
              <div className="bubble">{msg.text}</div>
            </div>
          );
        })}
      </main>

      <footer className="compose">
        <div className="chip-row">
          {STARTER_PHRASES[lang].map((phrase) => (
            <button key={phrase} type="button" className="chip" onClick={() => handleSend(phrase)} disabled={busy}>
              {phrase}
            </button>
          ))}
        </div>
        <ComposeBar lang={lang} onSend={handleSend} disabled={busy} />
        <div className="hint" />
        <button type="button" className="reset-link" onClick={resetChat}>
          {t(lang, "resetLink")}
        </button>
      </footer>

      {pricingGateFor && (
        <PricingGateModal
          lang={lang}
          onCancel={() => setPricingGateFor(null)}
          onContinue={() => {
            const result = pricingGateFor;
            setPricingGateFor(null);
            setDocumentFor(result);
          }}
        />
      )}

      {documentFor && <DocumentOverlay lang={lang} result={documentFor} onClose={() => setDocumentFor(null)} />}
    </div>
  );
}
