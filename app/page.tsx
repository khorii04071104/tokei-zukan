"use client";

import { useState } from "react";
import InventoryTab from "@/components/InventoryTab";
import MarketTab from "@/components/MarketTab";
import NotesTab from "@/components/NotesTab";

type Tab = "inventory" | "market" | "notes";

export default function Page() {
  const [tab, setTab] = useState<Tab>("inventory");

  return (
    <main className="min-h-screen bg-black text-zinc-200">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(212,165,116,0.08),transparent_50%)]" />

      <div className="max-w-7xl mx-auto px-6 py-10">
        <header className="mb-8 flex items-end justify-between border-b border-zinc-800 pb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-amber-500/80 mb-2">
              Personal Collection
            </p>
            <h1 className="font-serif text-4xl text-amber-50 tracking-tight">
              時計図鑑 <span className="text-amber-500/60">⌚</span>
            </h1>
          </div>
          <p className="hidden sm:block text-xs font-mono text-zinc-500">
            Watch Zukan v1.3
          </p>
        </header>

        <nav className="mb-8 flex gap-1 border-b border-zinc-800 overflow-x-auto">
          <TabButton active={tab === "inventory"} onClick={() => setTab("inventory")} color="amber">
            📦 マイ図鑑
          </TabButton>
          <TabButton active={tab === "market"} onClick={() => setTab("market")} color="blue">
            📊 相場データベース
          </TabButton>
          <TabButton active={tab === "notes"} onClick={() => setTab("notes")} color="emerald">
            📖 目利きノート
          </TabButton>
        </nav>

        {tab === "inventory" && <InventoryTab />}
        {tab === "market"    && <MarketTab />}
        {tab === "notes"     && <NotesTab />}

        <footer className="mt-16 pt-6 border-t border-zinc-900 text-center text-xs text-zinc-600 font-mono">
          Personal Watch Catalog · powered by Supabase
        </footer>
      </div>
    </main>
  );
}

function TabButton({
  active, onClick, color, children
}: {
  active: boolean;
  onClick: () => void;
  color: "amber" | "blue" | "emerald";
  children: React.ReactNode;
}) {
  const COLOR_MAP: Record<typeof color, string> = {
    amber: "text-amber-300 border-amber-500",
    blue: "text-blue-300 border-blue-500",
    emerald: "text-emerald-300 border-emerald-500"
  };
  const inactiveColor = "text-zinc-500 hover:text-zinc-300 border-transparent";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-5 py-3 text-sm font-semibold tracking-wider whitespace-nowrap
        border-b-2 -mb-px transition-colors
        ${active ? COLOR_MAP[color] : inactiveColor}
      `}
    >
      {children}
    </button>
  );
}
