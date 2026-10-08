// Ask the map: one box to find a place or ask a question, floating top-right of the map.
// Ported from the VisionPitts-Chat box (same author): the pill input that springs open, the thinking orb with its
// changing words, bubbles with tails and times, answers that write themselves in, suggested questions, fold and clear.
// What is typed is sorted in the browser: places go to the free map search, questions go to the assistant.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronUp, MapPin, Navigation, Sparkles, X } from 'lucide-react';
import { CHAT_COPY as C, apply, describe, exchanges as pair, isQuestion, useChat, type ChatMessage } from '../lib/chat';
import { getLayer, layers } from '../lib/content';
import { useApp } from '../lib/store';
import { cx } from '../lib/format';
import { PromptInput } from './ui/ai-chat-input';
import { ThinkingOrb } from './ui/thinking-orbs';

const SOFT = { type: 'spring', stiffness: 340, damping: 32, mass: 0.9 } as const;
const VIOLET = '#6d28d9';

interface Place {
  label: string;
  sub: string;
  lng: number;
  lat: number;
}
type Row = { kind: 'place'; key: string; place: Place } | { kind: 'ask'; key: string; text: string };

/** The thinking mark: an orb whose motion and words change as the seconds pass. */
function Thinking({ since }: { since: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const timers = C.phases.map((p, k) => window.setTimeout(() => setI(k), Math.max(0, p.at - (Date.now() - since))));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [since]);
  const p = C.phases[i];
  return (
    <div className="flex items-center gap-2.5 py-0.5" role="status" aria-label={C.thinking}>
      <span className="grid h-8 w-8 shrink-0 place-items-center">
        <ThinkingOrb state={p.state} size={32} theme="light" color={VIOLET} dotSize={1.35} dots={1.15} aria-hidden />
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={p.text} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.24 }} className="shimmer-text text-small font-medium">
          {p.text}…
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

const timeOf = (at: number) => {
  try {
    return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
};

/** The small point a bubble has at its lower corner, on the speaker's side. */
function Tail({ side, className }: { side: 'left' | 'right'; className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 8 10" className={cx('absolute bottom-0 h-2.5 w-2', side === 'right' ? '-right-[6px]' : '-left-[6px] -scale-x-100', className)}>
      <path d="M0 0 C0 6 3 9 8 10 L0 10 Z" fill="currentColor" />
    </svg>
  );
}

function UserBubble({ m }: { m: ChatMessage }) {
  return (
    <div className="group flex flex-col items-end" data-role="user">
      <div className="relative max-w-[85%] rounded-2xl rounded-br-md bg-violet-600 px-3 py-1.5 text-small text-white shadow-sm">
        <span className="whitespace-pre-wrap break-words">{m.text}</span>
        <Tail side="right" className="text-violet-600" />
      </div>
      <span className="mr-1 mt-0.5 text-[10.5px] leading-tight text-slate-400">{timeOf(m.at)}</span>
    </div>
  );
}

/** An answer that writes itself in, a few words at a time. `animate` is read once, when the answer arrives. */
function Reveal({ text, animate, className }: { text: string; animate: boolean; className?: string }) {
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);
  const [n, setN] = useState(animate ? 0 : tokens.length);
  useEffect(() => {
    if (!animate) return;
    let k = 0;
    const id = window.setInterval(() => {
      k += 4;
      setN(k);
      if (k >= tokens.length) window.clearInterval(id);
    }, 36);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div className={cx('whitespace-pre-wrap', className)}>{!animate || n >= tokens.length ? text : tokens.slice(0, n).join('')}</div>;
}

function AnswerBubble({ q, a, fresh }: { q: ChatMessage; a: ChatMessage | null; fresh: boolean }) {
  const thinking = !a || a.pending;
  const tone = thinking ? 'bg-white ring-stone-200 text-slate-800' : a.failed ? 'bg-stone-100 ring-stone-200 text-slate-600' : 'bg-white ring-stone-200 text-slate-800';
  const tail = thinking ? 'text-white' : a.failed ? 'text-stone-100' : 'text-white';
  const caption: string[] = [];
  if (a && !thinking && !a.failed) {
    caption.push(C.ai);
    if (a.checked) caption.push(C.checked);
  }
  return (
    <div className="flex flex-col items-start" data-role="assistant">
      <div className={cx('relative max-w-[88%] rounded-2xl rounded-bl-md px-3 py-1.5 text-small shadow-sm ring-1', tone)}>
        {thinking ? (
          <Thinking since={q.at} />
        ) : (
          <motion.div initial={fresh ? { opacity: 0, y: 4 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Reveal key={a.text} text={a.text} animate={fresh} className="break-words" />
            {a.unchecked && <p className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-caption text-amber-800 ring-1 ring-amber-200">{C.unchecked(a.unchecked)}</p>}
            {a.actions && a.actions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {a.actions.map((x, k) => (
                  <button key={k} onClick={() => apply(x)} title="Do this again" className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-caption font-medium text-violet-800 ring-1 ring-violet-200 transition-colors hover:bg-violet-100">
                    <Navigation className="h-3 w-3" />
                    {describe(x)}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
        <Tail side="left" className={tail} />
      </div>
      {!thinking && <span className="ml-1 mt-0.5 max-w-[85%] text-[10.5px] leading-tight text-slate-400">{[...caption, timeOf(a.at)].filter(Boolean).join(' · ')}</span>}
    </div>
  );
}

/** Address and place suggestions from Photon (OpenStreetMap), biased toward where the map is looking. */
async function placeSuggest(q: string, signal: AbortSignal): Promise<Place[]> {
  const map = (window as unknown as { __map?: { getCenter(): { lng: number; lat: number } } }).__map;
  const c = map?.getCenter();
  const bias = c ? `&lon=${c.lng.toFixed(3)}&lat=${c.lat.toFixed(3)}` : '';
  const r = await fetch(`https://photon.komoot.io/api/?limit=5&lang=en&q=${encodeURIComponent(q)}${bias}`, { signal });
  if (!r.ok) return [];
  const j = (await r.json()) as { features?: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }[] };
  const seen = new Set<string>();
  return (j.features ?? [])
    .map((f) => {
      const p = f.properties;
      const street = p.street ? `${p.housenumber ?? ''} ${p.street}`.trim() : '';
      const label = p.name ?? street ?? q;
      return { label: label || street, sub: [p.name && street ? street : '', p.city ?? p.county, p.state].filter(Boolean).join(', '), lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] };
    })
    .filter((p) => p.label && !seen.has(`${p.label}|${p.sub}`) && seen.add(`${p.label}|${p.sub}`))
    .slice(0, 4);
}

function suggestions(active: string[]): string[] {
  const on = active.length ? getLayer(active[active.length - 1]) : undefined;
  if (on) return [`Where is ${on.legend?.title?.toLowerCase() ?? 'it'} highest? Pin the top 3`, 'What does this dataset measure?', 'What am I looking at on the map?'];
  if (!layers.length) return ['What will this map show?', 'Take me to Center City Philadelphia'];
  return ['What data can I find here?', `Show me ${layers[0].title.charAt(0).toLowerCase()}${layers[0].title.slice(1)}`, 'What am I looking at on the map?'];
}

/** `compact`: over a small map with the page right under it (phones). It stays a pill until it is used, and never
 * touches the fold the wide-screen box remembers. */
export default function ChatBox({ compact = false }: { compact?: boolean }) {
  const messages = useChat((s) => s.messages);
  const busy = useChat((s) => s.busy);
  const ask = useChat((s) => s.ask);
  const clear = useChat((s) => s.clear);
  const storedFold = useChat((s) => s.folded);
  const setStoredFold = useChat((s) => s.setFolded);
  const agentPins = useApp((s) => s.agentPins);
  const activeLayers = useApp((s) => s.layers);
  const flyTo = useApp((s) => s.flyTo);
  const set = useApp((s) => s.set);
  const [value, setValue] = useState('');
  const [hi, setHi] = useState(0);
  const [inputOpen, setInputOpen] = useState(false);
  const [folded, setFoldedLocal] = useState(compact ? true : storedFold ?? false);
  const setFolded = (f: boolean | ((f: boolean) => boolean)) =>
    setFoldedLocal((cur) => {
      const next = typeof f === 'function' ? f(cur) : f;
      if (!compact && next !== storedFold) setStoredFold(next);
      return next;
    });
  const [remote, setRemote] = useState<{ q: string; items: Place[] } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  /** Answers that were being written while this box was on screen: only those write themselves in. */
  const wasPending = useRef(new Set<number>());

  const asked = useMemo(() => new Set(messages.filter((m) => m.role === 'user').map((m) => m.text.trim().toLowerCase())), [messages]);
  const prompts = useMemo(() => suggestions(activeLayers).filter((p) => !asked.has(p.toLowerCase())), [activeLayers, asked]);

  // ---------------------------------------------------------------- what was typed, sorted
  const text = value.trim();
  const question = isQuestion(text);
  const typing = text.length > 0;
  useEffect(() => {
    setHi(0);
    if (typing) setStatus(null);
  }, [text, typing]);
  useEffect(() => {
    if (question || text.length < 3) return setRemote(null);
    const ctl = new AbortController();
    const timer = window.setTimeout(() => {
      placeSuggest(text, ctl.signal)
        .then((items) => !ctl.signal.aborted && setRemote({ q: text, items }))
        .catch(() => !ctl.signal.aborted && setRemote({ q: text, items: [] }));
    }, 350);
    return () => {
      window.clearTimeout(timer);
      ctl.abort();
    };
  }, [text, question]);

  const rows = useMemo<Row[]>(() => {
    if (!typing) return [];
    const askRow: Row = { kind: 'ask', key: 'ask', text };
    const places: Row[] = (remote && remote.q === text ? remote.items : []).map((p) => ({ kind: 'place', key: `p:${p.label}|${p.sub}|${p.lng}`, place: p }));
    return question ? [askRow, ...places.slice(0, 2)] : [...places, askRow];
  }, [typing, text, question, remote]);

  // ---------------------------------------------------------------- doing it
  const send = (q: string): boolean => {
    if (busy) {
      setStatus(C.wait);
      return false;
    }
    setFolded(false);
    setStatus(null);
    void ask(q);
    return true;
  };
  const go = (p: Place) => {
    flyTo({ lng: p.lng, lat: p.lat, zoom: 15.5, pitch: 58, bearing: -20, name: p.label });
    set({ agentPins: [{ lng: p.lng, lat: p.lat, zoom: 15.5, pitch: 0, bearing: 0, label: p.label }] });
  };
  const act = (row: Row | undefined): boolean => {
    if (!row) return false;
    if (row.kind === 'ask') return send(row.text);
    go(row.place);
    return true;
  };
  const pick = (row: Row) => {
    if (act(row)) setValue('');
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!rows.length) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((h) => (e.key === 'ArrowDown' ? Math.min(h + 1, rows.length - 1) : Math.max(h - 1, 0)));
      return true;
    }
    return false;
  };

  // ---------------------------------------------------------------- the conversation
  useEffect(() => {
    let fresh = false;
    for (const m of messages) {
      if (!m.pending || wasPending.current.has(m.id)) continue;
      wasPending.current.add(m.id);
      fresh = true;
    }
    const el = list.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (fresh || nearBottom) requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: fresh ? 'smooth' : 'auto' }));
  }, [messages]);
  const exchanges = useMemo(() => pair(messages), [messages]);

  const quiet = compact && folded && !inputOpen;
  const hasAi = (prompts.length > 0 || messages.length > 0) && !quiet;
  const pin = agentPins[0];
  const hasNotes = (!!status || !!pin) && !quiet;
  const showRows = typing && rows.length > 0;
  const showAi = hasAi && !typing && !folded;
  const wide = inputOpen || showRows || showAi || hasNotes;
  const threadShown = showAi && exchanges.length > 0;
  // Once a conversation exists the box reads like most chats: name bar on top, the thread, the suggestions, then the input.
  const chat = messages.length > 0 && !quiet;
  useEffect(() => {
    const el = list.current;
    if (threadShown && el) el.scrollTop = el.scrollHeight;
  }, [threadShown]);

  return (
    <div className="pointer-events-auto ml-auto flex max-h-full w-full shrink-0 flex-col overflow-hidden rounded-[24px] bg-white/95 shadow-lg ring-1 ring-black/5 backdrop-blur transition-[max-width,box-shadow] duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.1)] focus-within:ring-2 focus-within:ring-violet-300" style={{ maxWidth: wide ? 440 : 320 }}>
      <div className={cx('shrink-0', chat && 'order-3 border-t border-stone-200/70 p-2')}>
        <div className={cx(chat && 'overflow-hidden rounded-2xl bg-stone-100 ring-1 ring-stone-200/80 transition-shadow focus-within:ring-2 focus-within:ring-violet-300')}>
          <PromptInput bare small={chat} value={value} onChange={setValue} onSubmit={() => act(rows[hi])} onKey={onKey} onOpenChange={setInputOpen} busy={busy} placeholder={C.ask} grey={chat} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showRows && (
          <motion.div key="rows" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SOFT} className={cx('shrink-0 overflow-hidden', chat && 'order-4')}>
            <ul role="listbox" aria-label={C.results} className="border-t border-stone-200/70 p-1.5">
              {rows.map((row, i) => (
                <li key={row.key}>
                  <button type="button" role="option" aria-selected={i === hi} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setHi(i)} onClick={() => pick(row)} className={cx('flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors', i === hi ? 'bg-violet-50' : 'hover:bg-stone-50')}>
                    {row.kind === 'ask' ? <Sparkles className="h-4 w-4 shrink-0 text-violet-600" /> : <MapPin className="h-4 w-4 shrink-0 text-slate-500" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-small font-medium text-slate-900">{row.kind === 'ask' ? C.askRow : row.place.label}</span>
                      <span className="block truncate text-caption text-slate-600">{row.kind === 'ask' ? `“${row.text}”` : row.place.sub}</span>
                    </span>
                    {row.kind === 'ask' && <span className="shrink-0 rounded-md bg-violet-100 px-1.5 py-px text-caption font-semibold text-violet-800">{C.askTag}</span>}
                    {i === hi && <span className="shrink-0 rounded-md bg-white px-1.5 py-px text-caption font-medium text-slate-500 ring-1 ring-stone-200">{C.enter} ↵</span>}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {hasNotes && !typing && (
          <motion.div key="notes" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SOFT} className={cx('shrink-0 overflow-hidden', chat && 'order-2')}>
            <div className="space-y-1 border-t border-stone-200/70 px-4 py-2">
              {status && (
                <p role="status" className="text-small text-rose-700">
                  {status}
                </p>
              )}
              {pin && (
                <p className="flex items-center gap-1.5 text-caption text-slate-600">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-violet-600" />
                  <span className="min-w-0 flex-1 truncate">
                    {C.pinned}: <span className="font-medium text-slate-800">{agentPins.map((p) => p.label).join(', ')}</span>
                  </span>
                  <button onClick={() => set({ agentPins: [] })} className="rounded-md p-0.5 text-slate-500 hover:bg-stone-100 hover:text-slate-900" aria-label={C.unpin} title={C.unpin}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showAi && (
          <motion.div key="ai" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SOFT} className={cx('flex min-h-0 flex-col overflow-hidden', chat && 'order-1')}>
            {prompts.length > 0 && (
              <div className={cx('shrink-0 border-t border-stone-200/70 px-2 py-1.5', chat && 'order-2 mt-auto')} aria-label={C.prompts}>
                {prompts.map((p, i) => (
                  <motion.button key={p} type="button" disabled={busy} onClick={() => send(p)} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SOFT, delay: 0.04 * i }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-small text-slate-500 transition-colors hover:bg-violet-50 hover:text-violet-800 disabled:opacity-50">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                    <span className="truncate">{p}</span>
                  </motion.button>
                ))}
              </div>
            )}
            {exchanges.length > 0 && (
              <div ref={list} className="scroll-quiet relative max-h-[46vh] overflow-y-auto overflow-x-hidden border-t border-stone-200/70 bg-stone-50/60 px-3.5 py-2.5 max-[859px]:max-h-[38vh]" aria-label={C.answers} aria-live="polite">
                <AnimatePresence initial={false}>
                  {exchanges.map(({ q, a }) => (
                    <motion.div key={q.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SOFT} className="flex flex-col gap-1.5 pb-3 last:pb-0">
                      <UserBubble m={q} />
                      <AnswerBubble q={q} a={a} fresh={!!a && wasPending.current.has(a.id)} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {hasAi && !typing && (
          <motion.div key="foot" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SOFT} className={cx('shrink-0 overflow-hidden', chat && 'order-first')}>
            <div className={cx('flex items-center justify-between gap-2 border-stone-200/70 py-1 pl-4 pr-1.5', chat ? 'border-b' : 'border-t')}>
              <span className="truncate text-caption font-semibold text-violet-700">{C.name}</span>
              <span className="flex shrink-0 items-center gap-0.5">
                {messages.length > 0 && !busy && (
                  <button onClick={clear} className="rounded-lg px-2 py-1 text-caption font-semibold text-slate-500 hover:bg-stone-100 hover:text-slate-900" title={C.clearTitle}>
                    {C.clear}
                  </button>
                )}
                <motion.button type="button" onClick={() => setFolded((f) => !f)} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.88 }} transition={SOFT} className="grid h-7 w-7 place-items-center rounded-full text-slate-500 hover:bg-stone-100 hover:text-slate-900" aria-expanded={!folded} aria-label={folded ? C.unfold : C.fold} title={folded ? C.unfold : C.fold}>
                  <motion.span animate={{ rotate: folded ? 180 : 0 }} transition={SOFT} className="grid place-items-center">
                    <ChevronUp className="h-4 w-4" />
                  </motion.span>
                </motion.button>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
