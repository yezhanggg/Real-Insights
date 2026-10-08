import { describe, expect, it } from 'vitest';
import { clean, runTool, search, tidy, untraced } from './agent';

describe('untraced', () => {
  it('passes figures that appear in the sources, with commas, rounding and percent forms', () => {
    const src = ['median_rent: 2979, renter_share: 0.983, households 1234.56'];
    expect(untraced('Rent is $2,979 and 98.3% rent; about 1,235 households.', src)).toEqual([]);
  });
  it('flags figures that appear nowhere', () => {
    expect(untraced('Rents rose 14.5% to $3,400.', ['rent 2979'])).toEqual(['14.5', '3400']);
  });
  it('lets small counts through', () => {
    expect(untraced('Here are 3 tracts.', [])).toEqual([]);
  });
});

describe('clean', () => {
  it('needs the last message to be from the user', () => {
    expect(clean({ messages: [{ role: 'assistant', text: 'hi' }] })).toBeNull();
    expect(clean({ messages: [{ role: 'user', text: ' hello ' }] })?.messages).toEqual([{ role: 'user', text: 'hello' }]);
  });
  it('drops junk and caps length', () => {
    const out = clean({ messages: [{ role: 'system', text: 'x' }, { role: 'user', text: 'a'.repeat(5000) }] });
    expect(out?.messages).toHaveLength(1);
    expect(out!.messages[0].text.length).toBe(1200);
  });
});

describe('map tools', () => {
  it('validates coordinates and queues a fly_to', async () => {
    const actions: unknown[] = [];
    expect(await runTool('fly_to', { lng: 500, lat: 0 }, actions as never)).toHaveProperty('error');
    await runTool('fly_to', { lng: -75.16, lat: 39.95, zoom: 99 }, actions as never);
    expect(actions).toEqual([{ type: 'fly_to', view: { lng: -75.16, lat: 39.95, zoom: 13, pitch: 55, bearing: -15, name: undefined } }]);
  });
  it('ignores unknown layers and tools', async () => {
    const actions: unknown[] = [];
    const r = (await runTool('show_layers', { layers: ['not-a-layer'] }, actions as never)) as { ignored?: string[] };
    expect(r.ignored).toEqual(['not-a-layer']);
    expect(await runTool('open_post', { slug: 'nope' }, actions as never)).toHaveProperty('error');
  });
});

describe('search and tidy', () => {
  it('finds nothing for an empty query', () => {
    expect(search('   ')).toEqual([]);
  });
  it('strips markdown', () => {
    expect(tidy('**Bold**\n- item')).toBe('Bold\n• item');
  });
});
