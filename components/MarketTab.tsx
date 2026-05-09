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

// 期間プリセット
const PERIOD_OPTIONS: { label: string; days: number }[] = [
  { label: "1ヶ月",  days: 30 },
  { label: "3ヶ月",  days: 90 },
  { label: "半年",  days: 180 },
  { label: "1年",   days: 365 },
  { label: "全期間", days: 0 }
];

// ============================================
// 相場集計サマリーカード
// ============================================
function MarketStatCard({
  label,
  value,
  subtext,
  highlight = false
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

// ============================================
// メイン
// ============================================
export default function MarketTab() {
  const [results, setResults] = useState<Watch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // フィルタ状態
  const [query, setQuery]         = useState("");
  const [channel, setChannel]     = useState<string>("");
  const [priceType, setPriceType] = useState<PriceType | "">("");
  const [daysAgo, setDaysAgo]     = useState<number>(90); // デフォルト: 過去3ヶ月

  // 検索実行 (フィルタが変わるたびに自動再検索)
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

  // 統計計算
  const stats = useMemo(() => {
    const prices = results
      .map(w => w.sale_price)
      .filter((p): p is number => p != null);
    return calcStats(prices);
  }, [results]);

  // 外れ値のしきい値 (Q1) - 表示用
  const q1 = useMemo(() => {
    const prices = [...results.map(w => w.sale_price).filter((p): p is number => p != null)].sort((a, b) => a - b);
    if (prices.length === 0) return 0;
    const q1Index = Math.floor(prices.length * 0.25);
    return prices[q1Index];
  }, [results]);

  const hasFilters = !!(query || channel || priceType);

  return (
    <>
      {/* 説明 */}
      <p className="text-xs text-zinc-500 mb-6 font-mono leading-relaxed">
        ⌕ 相場データベースは、Chrome拡張機能で集めた成約価格・買取相場の調査記録です。
        外れ値除外中央値は、安売り疑い (下位25%未満) を除いた値です。
      </p>

      {/* 検索フィルタ */}
      <section className="mb-6 space-y-3">
        {/* キーワード検索 */}
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

        {/* フィルタ群 */}
        <div className="flex flex-wrap gap-3">
          {/* チャネル */}
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5">
              調査元
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="
                w-full px-3 py-2
                bg-zinc-900/60 border border-zinc-800 rounded-md
                text-zinc-200 text-sm
                focus:outline-none focus:border-blue-500/50
              "
            >
              <option value="">すべて</option>
              {CHANNELS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 価格タイプ */}
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5">
              価格タイプ
            </label>
            <select
              value={priceType}
              onChange={(e) => setPriceType(e.target.value as PriceType | "")}
              className="
                w-full px-3 py-2
                bg-zinc-900/60 border border-zinc-800 rounded-md
                text-zinc-200 text-sm
                focus:outline-none focus:border-blue-500/50
              "
            >
              <option value="">すべて</option>
              <option value="sold">成約価格</option>
              <option value="buyback">買取相場</option>
            </select>
          </div>

          {/* 期間 */}
          <div className="flex-1 min-w-[200px]">
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
                    ${
                      daysAgo === opt.days
                        ? "bg-blue-500/15 text-blue-300"
                        : "text-zinc-500 hover:text-zinc-300"
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 絞り込み解除ボタン (フィルタがある時) */}
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery(""); setChannel(""); setPriceType("");
            }}
            className="text-xs text-zinc-500 hover:text-blue-300 transition-colors"
          >
            ✕ フィルタをクリア
          </button>
        )}
      </section>

      {/* 集計サマリー */}
      {!loading && results.length > 0 && (
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
          <MarketStatCard
            label="価格レンジ"
            value={`${yen(stats.min)}〜`}
            subtext={yen(stats.max)}
          />
        </section>
      )}

      {/* 検索結果カウント */}
      <p className="text-xs text-zinc-500 mb-4 font-mono">
        {loading ? "読み込み中..." : `${results.length} 件の調査記録`}
      </p>

      {/* エラー */}
      {error && (
        <div className="rounded-lg bg-rose-950/40 border border-rose-900 text-rose-200 px-5 py-4">
          <p className="text-sm font-bold mb-1">エラー</p>
          <p className="text-xs font-mono">{error}</p>
        </div>
      )}

      {/* 結果なし */}
      {!loading && !error && results.length === 0 && (
        <div className="text-center py-20 text-zinc-500">
          <p className="font-serif text-2xl mb-2 text-zinc-400">📊</p>
          <p>該当する相場データが見つかりませんでした</p>
          <p className="text-xs mt-2 text-zinc-600">
            Chrome拡張機能で売り切れ済みの商品ページを記録すると、ここに集まります
          </p>
        </div>
      )}

      {/* レコード一覧 */}
      {!loading && !error && results.length > 0 && (
        <section className="space-y-2">
          {results.map((w) => (
            <MarketRow key={w.id} watch={w} q1Threshold={q1} />
          ))}
        </section>
      )}
    </>
  );
}
