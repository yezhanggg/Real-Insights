// The chat input of Ask the map. Ported from VisionPitts (same author), unchanged apart from this line.
//
// Adapted from the "AI chat input" component supplied by the project owner (published on 21st.dev). Kept: the pill
// that springs open into a text area, the height that grows with the text and fades at its scroll edges, and the one
// button that turns from microphone to send to stop. Left out, because this tool has nothing behind them: the model
// and effort pickers, image attachments and the simulated voice demo. It uses the app's own colors and `cx`, so it
// needs no shadcn folder, path alias, animation package or extra theme variables.
// `bare` drops the card (surface, ring, shadow, width) so a parent can hold the input and its answers in one box.
import { forwardRef, useCallback, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../../lib/format';

const SPRING = 'cubic-bezier(0.175, 0.885, 0.32, 1.275)';
const MIN_TEXT = 68;
const MAX_TEXT = 160;
const CLOSED = 48;

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionCtor = new () => Recognition;
/** The browser's speech recognition, where it has one (Chrome, Edge, Safari). */
function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ArrowUp = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
    <path d="M7 12V2M7 2L2.5 6.5M7 2L11.5 6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Mic = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
    <rect x="5" y="1" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M2.75 6.5V7a4.25 4.25 0 0 0 8.5 0v-.5M7 11.25V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const Stop = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" fill="currentColor" />
  </svg>
);
const Spinner = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden className="animate-spin">
    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.75" />
    <path d="M12 7a5 5 0 0 0-5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

export interface PromptInputProps {
  /** Enter or the button. Return false to keep the text in the box (nothing was done with it). */
  onSubmit?: (value: string) => boolean | void;
  /** Sees every key first; return true when it handled the key (arrow keys in a list under the box). */
  onKey?: (e: KeyboardEvent<HTMLTextAreaElement>) => boolean;
  placeholder?: string;
  className?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  /** Waiting for an answer: the button spins while the box is empty. Text can still be typed and sent. */
  busy?: boolean;
  /** A quiet line under the text, e.g. what the question is about. */
  footer?: ReactNode;
  /** Offer the microphone where the browser can recognise speech. */
  voice?: boolean;
  /** Widths of the closed pill and the open box, in pixels. */
  closedWidth?: number;
  openWidth?: number;
  /** No surface, ring, shadow or width of its own: the parent is the box. */
  bare?: boolean;
  /** A shorter box with smaller text (the chat docked at the bottom of a column). */
  small?: boolean;
  /** Sits on a grey field: the scroll fades match it. */
  grey?: boolean;
  /** Told when the text area opens or closes, so a parent box can follow. */
  onOpenChange?: (open: boolean) => void;
}

export const PromptInput = forwardRef<HTMLDivElement, PromptInputProps>(function PromptInput(
  { onSubmit, onKey, placeholder = 'Ask anything', className, defaultValue = '', value: controlled, onChange, busy = false, footer, voice = true, closedWidth = 320, openWidth = 440, bare = false, small = false, grey = false, onOpenChange },
  ref,
) {
  const [expanded, setExpanded] = useState(false);
  const [smooth, setSmooth] = useState(false);
  const [local, setLocal] = useState(defaultValue);
  const [recording, setRecording] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => new Array(5).fill(0));
  const minText = small ? 44 : MIN_TEXT, maxText = small ? 120 : MAX_TEXT, closedH = small ? 38 : CLOSED;
  const [textHeight, setTextHeight] = useState(minText);
  const [scrolling, setScrolling] = useState(false);

  const isControlled = controlled !== undefined;
  const value = isControlled ? controlled : local;
  const hasValue = value.trim() !== '';
  const canVoice = voice && recognitionCtor() !== null;

  const valueRef = useRef(value);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const topFade = useRef<HTMLDivElement>(null);
  const bottomFade = useRef<HTMLDivElement>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => {
    onOpenChange?.(expanded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const updateFades = () => {
    const el = textRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (topFade.current) topFade.current.style.opacity = String(Math.min(scrollTop / 20, 1));
    if (bottomFade.current) bottomFade.current.style.opacity = String(Math.min(Math.max(scrollHeight - clientHeight - scrollTop - 16, 0) / 10, 1));
  };

  const change = useCallback(
    (v: string) => {
      setSmooth(true);
      if (!isControlled) setLocal(v);
      onChange?.(v);
    },
    [isControlled, onChange],
  );

  // ---------------------------------------------------------------- voice
  const stopRecording = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioRef.current?.close().catch(() => undefined);
    audioRef.current = null;
    setRecording(false);
    setLevels(new Array(5).fill(0));
  }, []);

  const startRecording = useCallback(async () => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    setSmooth(false);
    setExpanded(true);
    let stream: MediaStream | null = null;
    try {
      stream = (await navigator.mediaDevices?.getUserMedia({ audio: true })) ?? null;
    } catch {
      stream = null;
    }
    // No microphone, or the permission was declined: it stays a text box.
    if (!stream) return;
    streamRef.current = stream;
    setRecording(true);

    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      audioRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const step = Math.max(1, Math.floor(data.length / 5));
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setLevels(Array.from({ length: 5 }, (_, i) => data.slice(i * step, (i + 1) * step).reduce((s, v) => s + v, 0) / step / 255));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    }

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    let baseline = valueRef.current;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) baseline = `${baseline}${baseline ? ' ' : ''}${r[0].transcript.trim()}`;
        else interim += r[0].transcript;
      }
      change(`${baseline}${interim ? ` ${interim}` : ''}`.trim());
    };
    rec.onerror = () => stopRecording();
    rec.onend = () => stopRecording();
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      stopRecording();
    }
  }, [change, stopRecording]);

  useEffect(() => stopRecording, [stopRecording]);

  useEffect(() => {
    if (recording && textRef.current) textRef.current.scrollTop = textRef.current.scrollHeight;
  }, [value, recording]);

  // ---------------------------------------------------------------- open, close, size
  useEffect(() => {
    if (hasValue && !expanded) {
      setSmooth(false);
      setExpanded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasValue]);

  useEffect(() => {
    if (!expanded || recording) return;
    const timer = setTimeout(() => {
      const el = textRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 50);
    return () => clearTimeout(timer);
  }, [expanded, recording]);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const current = el.style.height;
    el.style.transition = 'none';
    el.style.height = '0px';
    const wanted = el.scrollHeight;
    el.style.height = current;
    void el.offsetHeight;
    el.style.transition = '';
    const next = Math.max(minText, Math.min(wanted, maxText));
    el.style.height = `${next}px`;
    setTextHeight(next);
    setScrolling(wanted > maxText);
    const t = setTimeout(updateFades, 0);
    return () => clearTimeout(t);
  }, [value, expanded]);

  const close = () => {
    setSmooth(false);
    setExpanded(false);
  };
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (boxRef.current?.contains(e.relatedTarget as Node | null)) return;
    if (!hasValue && !recording) close();
  };
  const submit = () => {
    const text = value.trim();
    if (!text) return;
    if (onSubmit?.(text) === false) return;
    change('');
    close();
  };

  const showStop = recording;
  const showSpin = busy && !recording && !hasValue;
  const showMic = !recording && !busy && !hasValue && canVoice;
  const showArrow = !recording && !showSpin && !showMic;
  const action = () => {
    if (recording) stopRecording();
    else if (hasValue) submit();
    else if (busy) return;
    else if (canVoice) void startRecording();
    else {
      setSmooth(false);
      setExpanded(true);
    }
  };
  const boxHeight = textHeight + (footer ? 34 : 10);
  const face = 'absolute inset-0 flex items-center justify-center transition-all duration-300';

  return (
    <div
      ref={(node) => {
        boxRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      onBlur={onBlur}
      className={cx('relative w-full', className)}
      style={bare ? undefined : { maxWidth: expanded ? openWidth : closedWidth, transition: smooth ? 'max-width 0.15s ease-out' : `max-width 0.4s ${SPRING}` }}
    >
      <div
        onMouseDown={(e) => {
          if (expanded && e.target !== textRef.current && !recording) {
            e.preventDefault();
            textRef.current?.focus();
          }
        }}
        style={{ borderRadius: bare ? 0 : 24, height: expanded ? boxHeight : closedH, transition: smooth ? 'height 0.15s ease-out' : `height 0.4s ${SPRING}` }}
        className={cx('relative w-full overflow-hidden', !bare && 'bg-white/95 shadow-lg ring-1 ring-black/5 backdrop-blur focus-within:ring-2 focus-within:ring-violet-300', expanded ? 'cursor-text' : 'cursor-default')}
      >
        <textarea
          ref={textRef}
          value={value}
          onChange={(e) => change(e.target.value)}
          onScroll={updateFades}
          onKeyDown={(e) => {
            if (onKey?.(e)) return;
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
            if (e.key === 'Escape' && !hasValue) close();
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          disabled={recording}
          tabIndex={expanded ? 0 : -1}
          style={{ transition: smooth ? 'height 0.15s ease-out' : `opacity 0.3s ease-out, transform 0.3s ease-out, height 0.4s ${SPRING}` }}
          className={cx(
            'scroll-quiet absolute inset-x-0 top-0 z-[1] w-full resize-none bg-transparent pl-4 pr-12 text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-500',
            small ? 'py-2.5 text-small leading-[20px]' : 'py-3.5 text-body leading-[22px]',
            expanded ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1 scale-95 opacity-0',
            scrolling ? 'overflow-y-auto' : 'overflow-y-hidden',
            recording && 'pointer-events-none',
          )}
        />
        <div ref={topFade} style={{ opacity: 0 }} className={cx('pointer-events-none absolute left-4 right-12 top-0 z-[2] h-8 bg-gradient-to-b to-transparent', grey ? 'from-stone-100 via-stone-100/90' : 'from-white via-white/90')} />
        <div ref={bottomFade} style={{ opacity: 0, top: textHeight - 32 }} className={cx('pointer-events-none absolute left-4 right-12 z-[2] h-8 bg-gradient-to-t to-transparent', grey ? 'from-stone-100 via-stone-100/90' : 'from-white via-white/90')} />

        <button
          type="button"
          onClick={() => {
            setSmooth(false);
            setExpanded(true);
          }}
          tabIndex={expanded ? -1 : 0}
          style={{ transition: smooth ? 'none' : `all 0.4s ${SPRING}` }}
          className={cx('absolute inset-x-0 top-0 z-[1] cursor-text truncate pl-4 pr-12 text-left font-medium leading-[18px] text-slate-500 outline-none', small ? 'py-[10px] text-small' : 'py-[15px] text-body', expanded ? 'pointer-events-none translate-y-1 scale-105 opacity-0' : 'translate-y-0 scale-100 opacity-100')}
        >
          {placeholder}
        </button>

        {footer && <div className={cx('absolute bottom-2.5 left-4 right-28 z-[3] truncate text-caption text-slate-500 transition-opacity duration-300', expanded && !recording ? 'opacity-100' : 'pointer-events-none opacity-0')}>{footer}</div>}

        <div className={cx('absolute right-12 z-[3]', small ? 'bottom-[3px]' : 'bottom-2', ' flex h-8 items-center justify-end gap-[3px] transition-all duration-300', recording ? 'w-16 opacity-100' : 'pointer-events-none w-0 opacity-0')} aria-hidden>
          {levels.map((v, i) => (
            <div key={i} className="w-1 rounded-full bg-violet-600 transition-[height] duration-75 ease-out" style={{ height: Math.max(4, v * 24) }} />
          ))}
        </div>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={action}
          disabled={showSpin}
          aria-label={showStop ? 'Stop recording' : showSpin ? 'Waiting for the answer' : showMic ? 'Speak instead of typing' : 'Go'}
          className={cx('absolute right-2 z-[3] flex h-8 w-8', small ? 'bottom-[3px]' : 'bottom-2', ' items-center justify-center rounded-full text-white outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-violet-300', showArrow && !hasValue ? 'bg-slate-300' : 'bg-violet-600 hover:bg-violet-700')}
        >
          <span className="relative flex h-full w-full items-center justify-center">
            <span className={cx(face, showArrow ? 'rotate-0 scale-100 opacity-100' : 'pointer-events-none rotate-45 scale-50 opacity-0')}>
              <ArrowUp />
            </span>
            <span className={cx(face, showMic ? 'rotate-0 scale-100 opacity-100' : 'pointer-events-none -rotate-45 scale-50 opacity-0')}>
              <Mic />
            </span>
            <span className={cx(face, showStop ? 'scale-100 opacity-100' : 'pointer-events-none scale-50 opacity-0')}>
              <Stop />
            </span>
            <span className={cx(face, showSpin ? 'scale-100 opacity-100' : 'pointer-events-none scale-50 opacity-0')}>
              <Spinner />
            </span>
          </span>
        </button>
      </div>
    </div>
  );
});
