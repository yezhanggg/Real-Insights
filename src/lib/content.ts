import raw from '../generated/content.json';
import type { Content, Layer } from './types';

export const content = raw as unknown as Content;
export const { site, layers } = content;

const layerById = new Map(layers.map((l) => [l.id, l]));
export const getLayer = (id: string): Layer | undefined => layerById.get(id);
