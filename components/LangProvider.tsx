"use client";

// Shared language state for the whole app: the 4-way EN/FR/AR/DAR switch
// lives in <LangSwitch>, but both <ChatShell> and <PortfolioPanel> (and the
// document overlay/modals they open) need to read the current language, so
// it's lifted into a small context rather than prop-drilled everywhere or
// duplicated as separate state per component.
//
// Also owns the one genuinely global side effect the HTML prototype's
// `renderStaticText()` performed: setting `document.documentElement.lang`
// and `dir` (real RTL for ar/dar, not a CSS trick), which is what lets
// `html[dir="rtl"] body, input, button, textarea { font-family: "IBM Plex
// Sans Arabic", ... }` in globals.css swap in the Arabic-script font stack.

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { Lang } from "@/lib/types";

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const isRtl = lang === "ar" || lang === "dar";
    document.documentElement.lang = lang === "dar" ? "ary" : lang;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang }), [lang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang() must be used within <LangProvider>.");
  return ctx;
}
