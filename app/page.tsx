"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchWatches, calcProfit, Watch } from "@/lib/supabase";
import WatchCard from "@/components/WatchCard";

// ============================================
// 円フォーマッタ
// ============================================
const yen = (n: number) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(n);

// ============================================
// ダッシュボードのKPIカード
// ============================================
function StatCard({
  label,
  value,
  subtext
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div className="
      relative overflow-hidden rounded-xl
      bg-gradient-to-br from-zinc-900 to-black
      border border-zinc-800
      p-5
    ">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
      <p className="text-[10px] uppercase tracking-[0.25em] text-amber-500/70 mb-2">
        {label}
      </p>
      <p className="font-serif text-3xl text-amber-50 tracking-tight">{value}</p>
      {subtext && <p className="text-xs text-zinc-500 mt-1 font-mono">{subtext}</p>}
    </div>
  );
}

// ============================================
// メインページ
// ============================================
export default function Page() {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [query, setQuery]     = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "stock" | "sold">("all");

  // ---- データ取得 ----
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await fetchWatches();
        setWatches(data);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---- 検索 + フィルタ ----
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return watches.filter((w) => {
      if (filterStatus === "stock" && w.sale_price != null) return false;
      if (filterStatus === "sold"  && w.sale_price == null) return false;
      if (!q) return true;
      const hay = [w.brand, w.model_name, w.ref_number ?? ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [watches, query, filterStatus]);

  // ---- 集計 (フィルタ後ではなく全体ベース) ----
  const stats = useMemo(() => {
    const total = watches.length;
    const inStock = watches.filter((w) => w.sale_price == null).length;
    const sold    = watches.filter((w) => w.sale_price != null);

    const totalProfit = sold.reduce((sum, w) => sum + (calcProfit(w) ?? 0), 0);
    const avgRate =
      sold.length > 0
        ? sold.reduce((sum, w) => {
            const p = calcProfit(w);
            return sum + (p != null && w.sale_price ? p / w.sale_price : 0);
          }, 0) / sold.length
        : 0;

    return { total, inStock, sold: sold.length, totalProfit, avgRate };
  }, [watches]);

  return (
    <main className="min-h-screen bg-black text-zinc-200">
      {/* 背景の微妙なグラデーション */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(212,165,116,0.08),transparent_50%)]" />

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* ヘッダー */}
        <header className="mb-10 flex items-end justify-between border-b border-zinc-800 pb-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-amber-500/80 mb-2">
              Personal Collection
            </p>
            <h1 className="font-serif text-4xl text-amber-50 tracking-tight">
              時計図鑑 <span className="text-amber-500/60">⌚</span>
            </h1>
          </div>
          <p className="hidden sm:block text-xs font-mono text-zinc-500">
            Watch Zukan v1.0
          </p>
        </header>

        {/* KPIカード */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <StatCard
            label="総在庫数"
            value={`${stats.inStock}`}
            subtext={`(累計 ${stats.total} 本 / 売却済 ${stats.sold} 本)`}
          />
          <StatCard
            label="見込 / 確定 総利益"
            value={yen(stats.totalProfit)}
            subtext="売却済みベース"
          />
          <StatCard
            label="平均利益率"
            value={`${(stats.avgRate * 100).toFixed(1)}%`}
            subtext="売却済みベース"
          />
        </section>

        {/* 検索 + フィルタ */}
        <section className="mb-8 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ブランド名・モデル名・型番で検索..."
              className="
                w-full px-4 py-3 pr-10
                bg-zinc-900/60 border border-zinc-800 rounded-lg
                text-zinc-100 placeholder:text-zinc-600
                focus:outline-none focus:border-amber-500/50 focus:bg-zinc-900
                transition-colors
              "
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">
              ⌕
            </span>
          </div>

          <div className="flex gap-1 bg-zinc-900/60 border border-zinc-800 rounded-lg p-1">
            {(["all", "stock", "sold"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`
                  px-4 py-2 text-xs uppercase tracking-wider rounded-md transition-colors
                  ${
                    filterStatus === s
                      ? "bg-amber-500/15 text-amber-300"
                      : "text-zinc-500 hover:text-zinc-300"
                  }
                `}
              >
                {s === "all" ? "All" : s === "stock" ? "In Stock" : "Sold"}
              </button>
            ))}
          </div>
        </section>

        {/* 結果カウント */}
        <p className="text-xs text-zinc-500 mb-4 font-mono">
          {filtered.length} / {watches.length} 件
        </p>

        {/* 状態別の表示 */}
        {loading && (
          <div className="text-center py-20 text-zinc-500">読み込み中...</div>
        )}

        {error && !loading && (
          <div className="rounded-lg bg-rose-950/40 border border-rose-900 text-rose-200 px-5 py-4">
            <p className="text-sm font-bold mb-1">エラー</p>
            <p className="text-xs font-mono">{error}</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-20 text-zinc-500">
            <p className="font-serif text-2xl mb-2 text-zinc-400">⌚</p>
            <p>該当する時計が見つかりませんでした</p>
          </div>
        )}

        {/* グリッド */}
        {!loading && !error && filtered.length > 0 && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((w) => (
              <WatchCard key={w.id} watch={w} />
            ))}
          </section>
        )}

        {/* フッター */}
        <footer className="mt-16 pt-6 border-t border-zinc-900 text-center text-xs text-zinc-600 font-mono">
          Personal Watch Catalog · powered by Supabase
        </footer>
      </div>
    </main>
  );
}
