// The shapes of src/generated/content.json (written by scripts/build-content.mjs).

export interface View {
  lng: number;
  lat: number;
  zoom: number;
  pitch: number;
  bearing: number;
  name?: string;
}

export interface Pin extends View {
  label: string;
}

/** A color: one hex, a ramp over a numeric field, steps at fixed breaks, or a color per category. */
export type ColorSpec =
  | string
  | { field: string; stops: [number, string][] }
  | { field: string; breaks: number[]; colors: string[] }
  | { field: string; categories: Record<string, string>; other?: string };

export type FieldFormat = 'money' | 'number' | 'percent' | 'percent100' | 'year' | 'text' | 'decimal';

export interface LayerStyle {
  type?: 'fill' | 'extrusion' | 'line' | 'circle' | 'heatmap' | 'raster';
  color?: ColorSpec;
  opacity?: number;
  outline?: string;
  width?: number;
  radius?: number | { field: string; stops: [number, number][] };
  height?: { field: string; scale?: number } | number;
}

export interface Layer {
  id: string;
  title: string;
  dek: string;
  about: string;
  source: { name: string; url?: string };
  license: string | null;
  updated: string | null;
  tags: string[];
  place: View | null;
  style: LayerStyle;
  legend: { title?: string; format?: FieldFormat; unit?: string } | null;
  popup: { title?: string; fields?: { field: string; label?: string; format?: FieldFormat }[] } | null;
  data?: string;
  tiles?: string;
  count?: number;
  bbox?: [number, number, number, number] | null;
  fields?: { name: string; type: string; min?: number; max?: number; examples?: string[] }[];
  geometry?: string | null;
  bytes?: number;
  image?: string | null;
  example?: boolean;
}

export interface Site {
  title: string;
  tagline: string;
  author: string;
  url: string;
  home: View;
  gate: 'off' | 'data' | 'map';
  links?: { label: string; url: string }[];
}

export interface Content {
  site: Site;
  layers: Layer[];
  built: string;
}
