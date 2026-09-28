"use client";

// The 4-way EN/FR/AR/DAR switch from the HTML prototype's `#langSwitch`.
// Selecting ar/dar flips the whole document to real RTL via LangProvider's
// effect (document.documentElement.dir), not just this component.

import type { Lang } from "@/lib/types";
import { useLang } from "./LangProvider";

const LANGS: Lang[] = ["en", "fr", "ar", "dar"];
const LANG_BUTTON_LABEL: Record<Lang, string> = { en: "EN", fr: "FR", ar: "AR", dar: "DAR" };

export function LangSwitch({ onChange }: { onChange?: (lang: Lang) => void }) {
  const { lang, setLang } = useLang();
  return (
    <div className="langs" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          className={l === lang ? "active" : ""}
          onClick={() => {
            setLang(l);
            onChange?.(l);
          }}
        >
          {LANG_BUTTON_LABEL[l]}
        </button>
      ))}
    </div>
  );
}
