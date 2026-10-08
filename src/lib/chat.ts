// The conversation with Ask the map: messages, the request to /api/agent, and carrying out what the agent asks
// the map to do. Kept across reloads (like VisionPitts-Chat), capped, and never sent anywhere but our own function.
import { create } from 'zustand';
import { useApp } from './store';
import type { Pin, View } from './types';

export type Action =
  | { type: 'fly_to'; view: View; label?: string }
  | { type: 'show_layers'; layers: string[]; label?: string }
  | { type: 'drop_pins'; pins: Pin[]; label?: string };

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  at: number;
  pending?: boolean;
  failed?: boolean;
  /** Every figure was found in the published data. */
  checked?: boolean;
  /** Figures that could not be traced. */
  unchecked?: string[];
  actions?: Action[];
}

export const CHAT_COPY = {
  name: 'Ask the map',
  ask: 'Search a place or ask a question',
  ai: 'AI-written',
  checked: 'checked against the published data',
  unchecked: (n: string[]) => `Check these figures: ${n.join(', ')} could not be matched to the published data.`,
  interrupted: 'The page was reloaded before this answer arrived. Ask again to get it.',
  noKey: 'The assistant is not connected yet. The site owner needs to add a DeepSeek key on the server.',
  limited: 'That is a lot of questions in a short time. Give it a minute and try again.',
  down: 'I could not answer that just now. Please try again in a moment.',
  offline: 'Could not reach the server. Are you online?',
  wait: 'One question at a time: the assistant is still answering.',
  results: 'Places and actions',
  askRow: 'Ask the assistant',
  askTag: 'AI',
  enter: 'Enter',
  prompts: 'Suggested questions',
  answers: 'Answers',
  clear: 'Clear',
  clearTitle: 'Clear the conversation',
  fold: 'Fold the answers away',
  unfold: 'Show the answers',
  thinking: 'Thinking',
  pinned: 'Pinned',
  unpin: 'Remove the pin',
  /** What the thinking mark says as the seconds pass. */
  phases: [
    { at: 0, state: 'searching', text: 'Reading the published data' },
    { at: 1800, state: 'solving', text: 'Finding the places' },
    { at: 4200, state: 'composing', text: 'Writing the answer' },
  ] as const,
};

/** Carries out one thing the agent asked the map to do. */
export function apply(a: Action) {
  const s = useApp.getState();
  if (a.type === 'fly_to') s.flyTo(a.view);
  else if (a.type === 'show_layers') s.set({ layers: a.layers, focus: a.layers[a.layers.length - 1] ?? s.focus, feature: null });
  else if (a.type === 'drop_pins') s.set({ agentPins: a.pins });
}

export function describe(a: Action): string {
  if (a.label) return a.label;
  if (a.type === 'fly_to') return `Moved the map${a.view.name ? ` to ${a.view.name}` : ''}`;
  if (a.type === 'show_layers') return a.layers.length ? `Turned on ${a.layers.length} layer${a.layers.length > 1 ? 's' : ''}` : 'Cleared the layers';
  return `Dropped ${a.pins.length} pin${a.pins.length > 1 ? 's' : ''}`;
}

const KEY = 'ri-chat-v1';
const CAP = 30;
function load(): { messages: ChatMessage[]; folded: boolean | null } {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { messages?: ChatMessage[]; folded?: boolean } | null;
    const messages = (raw?.messages ?? []).map((m) => (m.pending ? { ...m, pending: false, failed: true, text: CHAT_COPY.interrupted } : m));
    return { messages, folded: typeof raw?.folded === 'boolean' ? raw.folded : null };
  } catch {
    return { messages: [], folded: null };
  }
}
function save(messages: ChatMessage[], folded: boolean | null) {
  try {
    const out = messages.slice(-CAP);
    while (out.length && out[0].role === 'assistant') out.shift();
    localStorage.setItem(KEY, JSON.stringify({ messages: out, folded }));
  } catch {
    /* private mode: the conversation lasts for this visit */
  }
}

interface ChatState {
  messages: ChatMessage[];
  busy: boolean;
  folded: boolean | null;
  ask: (q: string) => Promise<void>;
  clear: () => void;
  setFolded: (f: boolean) => void;
}

let nextId = Date.now();
const initial = load();

export const useChat = create<ChatState>((set, get) => ({
  messages: initial.messages,
  busy: false,
  folded: initial.folded,
  setFolded: (folded) => {
    set({ folded });
    save(get().messages, folded);
  },
  clear: () => {
    set({ messages: [] });
    save([], get().folded);
  },
  ask: async (q) => {
    const text = q.trim();
    if (!text || get().busy) return;
    const user: ChatMessage = { id: ++nextId, role: 'user', text, at: Date.now() };
    const pending: ChatMessage = { id: ++nextId, role: 'assistant', text: '', at: Date.now(), pending: true };
    const history = get().messages.filter((m) => !m.failed && !m.pending);
    set({ messages: [...get().messages, user, pending], busy: true });
    const finish = (patch: Partial<ChatMessage>) => {
      set({ busy: false, messages: get().messages.map((m) => (m.id === pending.id ? { ...m, ...patch, pending: false, at: Date.now() } : m)) });
      save(get().messages, get().folded);
    };
    const map = (window as unknown as { __map?: { getCenter(): { lng: number; lat: number }; getZoom(): number } }).__map;
    const c = map?.getCenter();
    try {
      const r = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [...history, user].slice(-10).map((m) => ({ role: m.role, text: m.text })),
          context: { path: location.pathname, center: c ? [Number(c.lng.toFixed(5)), Number(c.lat.toFixed(5))] : null, zoom: map ? Number(map.getZoom().toFixed(1)) : null, layers: useApp.getState().layers },
        }),
      });
      const j = (await r.json()) as { ok: boolean; text?: string; actions?: Action[]; unverified?: string[]; reason?: string };
      if (!j.ok) return finish({ failed: true, text: j.reason === 'no_api_key' ? CHAT_COPY.noKey : j.reason === 'rate_limited' ? CHAT_COPY.limited : CHAT_COPY.down });
      for (const a of j.actions ?? []) apply(a);
      finish({ text: j.text ?? '', actions: j.actions, checked: !j.unverified?.length, unchecked: j.unverified?.length ? j.unverified : undefined });
    } catch {
      finish({ failed: true, text: CHAT_COPY.offline });
    }
  },
}));

/** Pairs each question with its answer, oldest first. */
export function exchanges(messages: ChatMessage[]): { q: ChatMessage; a: ChatMessage | null }[] {
  const out: { q: ChatMessage; a: ChatMessage | null }[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== 'user') continue;
    const next = messages[i + 1];
    out.push({ q: m, a: next?.role === 'assistant' ? next : null });
  }
  return out;
}

const QUESTION = /^(what|which|where|why|how|who|when|is|are|was|were|can|could|should|would|do|does|did|show|tell|compare|find|list|explain|give|take|open|turn|pin|zoom|any|i |i'm|help)\b/i;
/** Questions go to the assistant; anything that reads like a place or address goes to the free map search first. */
export function isQuestion(text: string): boolean {
  const t = text.trim();
  return t.endsWith('?') || QUESTION.test(t) || t.split(/\s+/).length > 6;
}
