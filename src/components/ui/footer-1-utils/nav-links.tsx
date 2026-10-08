// The footer's link columns.
import type React from 'react';

export interface FooterLink {
  label: string;
  href: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}
export interface FooterSection {
  title: string;
  links: FooterLink[];
}

export function NavLinks({ sections }: { sections: FooterSection[] }) {
  return (
    <div className="grid flex-1 grid-cols-2 gap-8 sm:grid-cols-3">
      {sections.map((section) => (
        <div key={section.title} className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
          <ul className="space-y-2">
            {section.links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  onClick={link.onClick}
                  target={/^https?:/.test(link.href) ? '_blank' : undefined}
                  rel={/^https?:/.test(link.href) ? 'noreferrer' : undefined}
                  className="rounded text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
