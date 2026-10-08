// /updates — every release, newest first. Hover a row for a preview; click to open it on the map.
import { useEffect } from 'react';
import { layers, site } from '../lib/content';
import { ProjectShowcase, type ShowcaseItem } from './ui/project-showcase';
import SiteFooter from './ui/footer-1';
import SiteHeader from './SiteHeader';
import { exploreMap } from './Landing';

/** Stock city photos (Unsplash) for releases that have no cover image of their own. */
const COVERS = [
  'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df',
  'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b',
  'https://images.unsplash.com/photo-1449824913935-59a10b8d2000',
  'https://images.unsplash.com/photo-1486325212027-8081e485255e',
  'https://images.unsplash.com/photo-1444723121867-7a241cacace9',
].map((u) => `${u}?w=640&q=70&auto=format&fit=crop`);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthYear = (iso: string | null) => (iso ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : '');

export default function Updates() {
  useEffect(() => {
    document.title = `Release updates · ${site.title}`;
  }, []);
  const items: ShowcaseItem[] = layers.map((l, i) => ({
    title: l.title,
    description: l.dek || l.source.name,
    year: monthYear(l.updated),
    link: `/map/${l.id}`,
    image: l.image || COVERS[i % COVERS.length],
    badge: l.example ? 'Example' : undefined,
  }));

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_6%_0%,#fffdfb_0%,#fcfbff_40%,#f6f2ff_100%)]">
      <SiteHeader current="updates" />
      <main className="mx-auto max-w-2xl px-6 pt-10">
        <p className="text-xs font-medium uppercase tracking-[0.36em] text-violet-500">Release updates</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">Every dataset, as it lands.</h1>
        <p className="mt-4 text-lg text-[#7f7699]">New data goes on the live map as it's ready. Hover a release for a preview; open it to see it on the map.</p>
      </main>
      {items.length ? (
        <ProjectShowcase
          heading="All releases"
          items={items}
          onSelect={(item, e) => {
            if (e.metaKey || e.ctrlKey) return;
            e.preventDefault();
            exploreMap(item.link);
          }}
        />
      ) : (
        <section className="mx-auto w-full max-w-2xl px-6 py-16">
          <p className="border-y border-border py-6 text-muted-foreground">The first dataset is on its way. Subscribe and you'll hear the day it goes live.</p>
        </section>
      )}
      <SiteFooter />
    </div>
  );
}
