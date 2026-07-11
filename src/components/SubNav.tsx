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
    <div className="flex gap-2 px-6 pt-4 pb-2 max-w-5xl mx-auto">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            isActive(item.href)
              ? "bg-accent text-background"
              : "bg-surface text-muted border border-border hover:text-foreground"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
