"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchMarketWatches,
  CHANNELS,
  calcStats,
  Watch,
  MarketFilter,
  PriceType
} from "@/lib/supabase";
import MarketRow from "@/components/MarketRow";

const yen = (n: number) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(n);

const PERIOD_OPTIONS: { label: string; days: number }[] = [
  { label: "1ヶ月",  days: 30 },
  { label: "3ヶ月",  days: 90 },
  { label: "半年",  days: 180 },
  { label: "1年",   days: 365 },
  { label: "全期間", days: 0 }
];

// 回転率フィルタ: 何日以内で売れた商品か
const TURNOVER_OPTIONS: { label: string; maxDays: number | null }[] = [
  { label: "すべて",       maxDays: null },
  { label: "7日以内 ⚡",   maxDays: 7   },
  { label: "30日以内",     maxDays: 30  },
  { label: "90日以内",     maxDays: 90  }
];

function MarketStatCard({
  label, value, subtext, highlight = false
}: {
  label: string;
  value: string;
  subtext?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`
      relative overflow-hidden rounded-xl
      bg-gradient-to-br from-zinc-900 to-black
      border ${highlight ? "border-blue-500/40" : "border-zinc-800"}
      p-5
    `}>
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${highlight ? "via-blue-400/80" : "via-blue-500/40"} to-transparent`} />
      <p className="text-[10px] uppercase tracking-[0.25em] text-blue-300/80 mb-2">
        {label}
      </p>
      <p className={`font-serif text-3xl tracking-tight ${highlight ? "text-blue-100" : "text-zinc-200"}`}>
        {value}
      </p>
      {subtext && <p className="text-xs text-zinc-500 mt-1 font-mono">{subtext}</p>}
    </div>
  );
}

export default function MarketTab() {
  const [results, setResults] = useState<Watch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // フィルタ状態
  const [query, setQuery]         = useState("");
  const [channel, setChannel]     = useState<string>("");
  const [priceType, setPriceType] = useState<PriceType | "">("");
  const [daysAgo, setDaysAgo]     = useState<number>(90);
  const [maxTurnover, setMaxTurnover] = useState<number | null>(null);

  useEffect(() => {
    const filter: MarketFilter = {
      query,
      channel: channel || undefined,
      priceType: priceType || undefined,
      daysAgo
    };

    let canceled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchMarketWatches(filter);
        if (!canceled) setResults(data);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!canceled) setError(msg);
      } finally {
        if (!canceled) setLoading(false);
      }
    })();

    return () => { canceled = true; };
  }, [query, channel, priceType, daysAgo]);

  // 回転率フィルタはクライアントサイドで適用 (days_to_sell が null の行は除外)
  const filtered = useMemo(() => {
    if (maxTurnover == null) return results;
    return results.filter(w => w.days_to_sell != null && w.days_to_sell <= maxTurnover);
  }, [results, maxTurnover]);

  const stats = useMemo(() => {
    const prices = filtered
      .map(w => w.sale_price)
      .filter((p): p is number => p != null);
    return calcStats(prices);
  }, [filtered]);

  const q1 = useMemo(() => {
    const prices = [...filtered.map(w => w.sale_price).filter((p): p is number => p != null)].sort((a, b) => a - b);
    if (prices.length === 0) return 0;
    const q1Index = Math.floor(prices.length * 0.25);
    return prices[q1Index];
  }, [filtered]);

  // 回転率の平均 (フィルタ後の data_to_sell が取れているもののみ)
  const turnoverStats = useMemo(() => {
    const days = filtered.map(w => w.days_to_sell).filter((d): d is number => d != null);
    if (days.length === 0) return null;
    const sum = days.reduce((s, v) => s + v, 0);
    const sorted = [...days].sort((a, b) => a - b);
    const median =
      days.length % 2 === 0
        ? (sorted[days.length / 2 - 1] + sorted[days.length / 2]) / 2
        : sorted[Math.floor(days.length / 2)];
    return {
      mean: sum / days.length,
      median,
      count: days.length
    };
  }, [filtered]);

  const hasFilters = !!(query || channel || priceType || maxTurnover != null);

  return (
    <>
      <p className="text-xs text-zinc-500 mb-6 font-mono leading-relaxed">
        ⌕ 相場データベースは、Chrome拡張機能で集めた成約価格・買取相場の調査記録です。
        メルカリでは「出品から売却までの日数」も同時に取得され、回転率での絞り込みができます。
      </p>

      {/* 検索フィルタ */}
      <section className="mb-6 space-y-3">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ブランド・モデル名・型番で検索 (例: ROLEX サブマリーナ)"
            className="
              w-full px-4 py-3 pr-10
              bg-zinc-900/60 border border-zinc-800 rounded-lg
              text-zinc-100 placeholder:text-zinc-600
              focus:outline-none focus:border-blue-500/50 focus:bg-zinc-900
              transition-colors
            "
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">
            ⌕
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5">
              調査元
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-blue-500/50"
            >
              <option value="">すべて</option>
              {CHANNELS.map(c => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>

          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5">
              価格タイプ
            </label>
            <select
              value={priceType}
              onChange={(e) => setPriceType(e.target.value as PriceType | "")}
              className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 rounded-md text-zinc-200 text-sm focus:outline-none focus:border-blue-500/50"
            >
              <option value="">すべて</option>
              <option value="sold">成約価格</option>
              <option value="buyback">買取相場</option>
            </select>
          </div>
        </div>

        {/* 期間 */}
        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5">
            期間
          </label>
          <div className="flex gap-1 bg-zinc-900/60 border border-zinc-800 rounded-md p-1">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.days}
                type="button"
                onClick={() => setDaysAgo(opt.days)}
                className={`
                  flex-1 px-2 py-1.5 text-[11px] uppercase tracking-wider rounded transition-colors
                  ${daysAgo === opt.days
                    ? "bg-blue-500/15 text-blue-300"
                    : "text-zinc-500 hover:text-zinc-300"}
                `}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 回転率フィルタ */}
        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5">
            回転率 (出品から売却までの日数)
          </label>
          <div className="flex gap-1 bg-zinc-900/60 border border-zinc-800 rounded-md p-1">
            {TURNOVER_OPTIONS.map(opt => (
              <button
                key={String(opt.maxDays)}
                type="button"
                onClick={() => setMaxTurnover(opt.maxDays)}
                className={`
                  flex-1 px-2 py-1.5 text-[11px] uppercase tracking-wider rounded transition-colors
                  ${maxTurnover === opt.maxDays
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-zinc-500 hover:text-zinc-300"}
                `}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery(""); setChannel(""); setPriceType(""); setMaxTurnover(null);
            }}
            className="text-xs text-zinc-500 hover:text-blue-300 transition-colors"
          >
            ✕ フィルタをクリア
          </button>
        )}
      </section>

      {/* 集計サマリー */}
      {!loading && filtered.length > 0 && (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <MarketStatCard
            label="件数"
            value={`${stats.count}`}
            subtext={`外れ値除外: ${stats.filteredCount}件`}
          />
          <MarketStatCard
            label="中央値 (外れ値除外)"
            value={yen(Math.round(stats.medianFiltered))}
            subtext="目利きの目安"
            highlight
          />
          <MarketStatCard
            label="平均"
            value={yen(Math.round(stats.mean))}
            subtext="参考"
          />
          {turnoverStats ? (
            <MarketStatCard
              label="平均回転日数"
              value={`${Math.round(turnoverStats.mean)}日`}
              subtext={`中央値: ${Math.round(turnoverStats.median)}日 (${turnoverStats.count}件)`}
            />
          ) : (
            <MarketStatCard
              label="価格レンジ"
              value={`${yen(stats.min)}〜`}
              subtext={yen(stats.max)}
            />
          )}
        </section>
      )}

      <p className="text-xs text-zinc-500 mb-4 font-mono">
        {loading ? "読み込み中..." : `${filtered.length} 件の調査記録${maxTurnover ? ` (回転率フィルタ適用)` : ""}`}
      </p>

      {error && (
        <div className="rounded-lg bg-rose-950/40 border border-rose-900 text-rose-200 px-5 py-4">
          <p className="text-sm font-bold mb-1">エラー</p>
          <p className="text-xs font-mono">{error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-20 text-zinc-500">
          <p className="font-serif text-2xl mb-2 text-zinc-400">📊</p>
          <p>該当する相場データが見つかりませんでした</p>
          <p className="text-xs mt-2 text-zinc-600">
            Chrome拡張機能で売り切れ済みの商品ページを記録すると、ここに集まります
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <section className="space-y-2">
          {filtered.map((w) => (
            <MarketRow key={w.id} watch={w} q1Threshold={q1} />
          ))}
        </section>
      )}
    </>
  );
}
