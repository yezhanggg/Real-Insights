// What every part of the map tool agrees on: where the map should be, which layers are on, what is selected.
import { create } from 'zustand';
import type { Pin, View } from './types';

export interface CameraRequest extends View {
  /** Changes on every request so the same view can be asked for twice. */
  key: number;
  duration?: number;
}

export interface MarkerSpec {
  id: string;
  lng: number;
  lat: number;
  mark: string;
  label: string;
  tone?: 'pin' | 'agent';
}

export interface FeatureInfo {
  layer: string;
  lng: number;
  lat: number;
  props: Record<string, unknown>;
  geometry: GeoJSON.Geometry | null;
}

/** How the map looks (the Settings section). */
export interface MapLook {
  buildings: boolean;
  terrain: boolean;
  hillshade: boolean;
}

interface State {
  camera: CameraRequest | null;
  layers: string[];
  markers: MarkerSpec[];
  /** Pins from the assistant or the place search. */
  agentPins: Pin[];
  look: MapLook;
  /** The layer whose details show in the right panel. */
  focus: string | null;
  feature: FeatureInfo | null;
  railOpen: boolean;
  panelOpen: boolean;
  hintClosed: boolean;
  subscribed: boolean;
  /** The Subscribe pop-up, and where to go once the reader is in. */
  subscribeOpen: boolean;
  subscribeNext: string | null;
  flyTo: (v: View, duration?: number) => void;
  set: (p: Partial<State>) => void;
}

const SUB_KEY = 'ri-subscribed';
function readSubscribed(): boolean {
  try {
    return localStorage.getItem(SUB_KEY) === '1';
  } catch {
    return false;
  }
}
export function rememberSubscribed() {
  try {
    localStorage.setItem(SUB_KEY, '1');
  } catch {
    /* private mode: they will be asked again next visit */
  }
  useApp.setState({ subscribed: true });
}

const phone = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches;

let key = 0;
export const useApp = create<State>((set) => ({
  camera: null,
  layers: [],
  markers: [],
  agentPins: [],
  look: { buildings: true, terrain: true, hillshade: false },
  focus: null,
  feature: null,
  railOpen: !phone(),
  panelOpen: false,
  hintClosed: false,
  subscribed: readSubscribed(),
  subscribeOpen: false,
  subscribeNext: null,
  flyTo: (v, duration) => set({ camera: { ...v, key: ++key, duration } }),
  set: (p) => set(p),
}));
