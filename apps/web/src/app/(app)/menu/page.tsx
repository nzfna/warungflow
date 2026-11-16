"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { useMe, visibleNav } from "@/components/Shell";

export default function Menu() {
  const me = useMe();
  return (
    <>
      <PageHeader title="Menu" />
      <div className="space-y-5">
        {visibleNav(me.role!).map((g) => (
          <section key={g.group}>
            <h2 className="mb-1 text-xs font-semibold text-ink-2">{g.group}</h2>
            <ul className="divide-y divide-line rounded-card border border-line bg-white">
              {g.items.map((i) => (
                <li key={i.href}><Link href={i.href} className="flex min-h-[52px] items-center justify-between px-4"><span className="flex items-center gap-3"><i.icon className="h-5 w-5 text-ink-2" aria-hidden />{i.label}</span><ChevronRight className="h-4 w-4 text-ink-3" aria-hidden /></Link></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
