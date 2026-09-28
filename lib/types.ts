// Shared types for the Mizan chat pipeline: EXTRACT -> CONFIRM -> COMPUTE -> EXPLAIN.
// Mirrors the state machine described in the validated HTML prototype
// (mizan_chat_artifact.html) and the master spec's account of the Python
// mizan_api's chat_schemas.py design — re-expressed here in TypeScript
// since that Python source was not available to port from directly in
// this session (see README.md, "What this port is / is not").

export type Lang = "en" | "fr" | "ar" | "dar";

export type Relation =
  | "husband"
  | "wife"
  | "son"
  | "daughter"
  | "father"
  | "mother"
  | "full_brother"
  | "full_sister";

export type HeirDraft = Record<Relation, number>;

export const EMPTY_DRAFT: HeirDraft = {
  husband: 0,
  wife: 0,
  son: 0,
  daughter: 0,
  father: 0,
  mother: 0,
  full_brother: 0,
  full_sister: 0,
};

export const RELATION_ORDER: Relation[] = [
  "husband",
  "wife",
  "father",
  "mother",
  "son",
  "daughter",
  "full_brother",
  "full_sister",
];

export type ShareClass =
  | "fardh"
  | "asaba"
  | "asaba_by_other"
  | "asaba_with_other"
  | "special_case"
  | "excluded";

export interface ShareLine {
  relation: Relation;
  /** exact fraction, serialized as [numerator, denominator] over the wire */
  share: [number, number];
  cls: ShareClass;
  count: number;
  isEach: boolean;
  article: string;
}

export type Confidence = "standard" | "special_case_matched" | "unsupported";

export interface ComputeResult {
  lines: ShareLine[];
  confidence: Confidence;
  specialCase: "gharawyn" | null;
  awlApplied: boolean;
  raddApplied: boolean;
}

export type ChatStage = "collecting" | "awaiting_confirmation" | "computed";

/**
 * The request body for POST /api/chat/turn. The mandatory confirm-before-
 * compute gate is enforced structurally, not by parsing free text: a turn
 * that arrives while the previous response's stage was
 * "awaiting_confirmation" MUST carry userAction ("confirm" | "correct");
 * any other shape is a 400, exactly mirroring the described Pydantic
 * validator in the Python design this re-implements.
 */
export interface ChatTurnRequest {
  lang: Lang;
  message: string;
  /** The heir draft accumulated so far this conversation (client keeps state, same as the validated demo). */
  draft: HeirDraft;
  stage: ChatStage;
  userAction?: "confirm" | "correct";
}

export interface ChatTurnResponse {
  stage: ChatStage;
  draft: HeirDraft;
  assistantText?: string;
  result?: ComputeResult;
  /** true when EXTRACT used the real Claude API rather than the deterministic fallback matcher */
  extractedByModel: boolean;
  /** true when EXPLAIN used a Claude-written, validated explanation rather than the deterministic template */
  explainedByModel: boolean;
}

export interface WaitlistEntry {
  kind: "adoul" | "family";
  name: string;
  contact: string;
  extra: string;
  language: Lang;
  at: string;
}
