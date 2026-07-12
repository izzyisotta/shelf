"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SubNavItem {
  label: string;
  href: string;
}

interface Props {
  items: SubNavItem[];
  defaultHref: string;
}

export default function SubNav({ items, defaultHref }: Props) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (pathname === href) return true;
    if (href === defaultHref && pathname === defaultHref.replace(/\/[^/]+$/, "")) return true;
    return false;
  }

  return (
    <div className="flex gap-6 px-4 md:px-6 pt-4 max-w-5xl mx-auto border-b border-border">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`pb-2 -mb-px text-xs font-medium uppercase tracking-widest transition-colors border-b-2 ${
            isActive(item.href)
              ? "text-foreground border-accent"
              : "text-muted border-transparent hover:text-foreground"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
