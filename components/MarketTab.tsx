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

const TURNOVER_OPTIONS: { label: string; maxDays: number | null }[] = [
  { label: "すべて",       maxDays: null },
  { label: "7日以内 ⚡",   maxDays: 7   },
  { label: "30日以内",     maxDays: 30  },
  { label: "90日以内",     maxDays: 90  }
];

// タグカテゴリ (UIで分類表示するため)
// AIプロンプトで使った語彙と一致させる
const TAG_CATEGORIES: { label: string; tags: string[] }[] = [
  { label: "サイズ",      tags: ["14cm","15cm","16cm","17cm","18cm","19cm","20cm","21cm"] },
  { label: "性別",        tags: ["メンズ","レディース","ユニセックス"] },
  { label: "ムーブメント", tags: ["手巻き","自動巻き","クォーツ","ソーラー","電波"] },
  { label: "風防",        tags: ["プラスチック風防","クリスタル風防","サファイア風防","ミネラルガラス"] },
  { label: "ケース素材",  tags: ["18K無垢","14K無垢","750無垢","GP金メッキ","GF金張り","GEP電気メッキ","GR金張り","ステンレス","チタン","プラチナ"] },
  { label: "文字盤色",    tags: ["白文字盤","黒文字盤","青文字盤","緑文字盤","シルバー文字盤","ゴールド文字盤","ベッコウ柄","オパール文字盤","パール文字盤","赤文字盤"] },
  { label: "デザイン",    tags: ["ラインストーン","デイデイト","ブレスウォッチ","ギザギザベゼル","ペンダントウォッチ","コインウォッチ","リングウォッチ","スケルトン","ダイヤ装飾"] },
  { label: "状態",        tags: ["新品","美品","良品","並品","ジャンク"] },
  { label: "付属品",      tags: ["フルセット","箱あり","保証書あり","余りコマあり","取説あり","箱なし","保証書なし"] },
  { label: "時代",        tags: ["ヴィンテージ","アンティーク","モダン"] }
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

  const [query, setQuery]         = useState("");
  const [channel, setChannel]     = useState<string>("");
  const [priceType, setPriceType] = useState<PriceType | "">("");
  const [daysAgo, setDaysAgo]     = useState<number>(90);
  const [maxTurnover, setMaxTurnover] = useState<number | null>(null);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [showAllTags, setShowAllTags] = useState(false);  // タグクラウド全展開

  // タグ絞り込みは Supabase 側でフィルタするので、tags も dependency に
  useEffect(() => {
    const filter: MarketFilter = {
      query,
      channel: channel || undefined,
      priceType: priceType || undefined,
      daysAgo,
      tags: activeTags.size > 0 ? [...activeTags] : undefined
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
  }, [query, channel, priceType, daysAgo, activeTags]);

  // 回転率フィルタはクライアントサイドで適用
  const filtered = useMemo(() => {
    if (maxTurnover == null) return results;
    return results.filter(w => w.days_to_sell != null && w.days_to_sell <= maxTurnover);
  }, [results, maxTurnover]);

  // 結果データに含まれるタグの頻度カウント (タグクラウド用)
  const tagFrequency = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const w of filtered) {
      const tags = w.tags || [];
      for (const t of tags) {
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
    return counts;
  }, [filtered]);

  // 頻出タグTOP10 (タグクラウドのデフォルト表示)
  const topTags = useMemo(() => {
    return Object.entries(tagFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
  }, [tagFrequency]);

  const stats = useMemo(() => {
    const prices = filtered.map(w => w.sale_price).filter((p): p is number => p != null);
    return calcStats(prices);
  }, [filtered]);

  const q1 = useMemo(() => {
    const prices = [...filtered.map(w => w.sale_price).filter((p): p is number => p != null)].sort((a, b) => a - b);
    if (prices.length === 0) return 0;
    const q1Index = Math.floor(prices.length * 0.25);
    return prices[q1Index];
  }, [filtered]);

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

  const hasFilters = !!(query || channel || priceType || maxTurnover != null || activeTags.size > 0);

  // タグの ON/OFF
  function toggleTag(tag: string) {
    setActiveTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  return (
    <>
      <p className="text-xs text-zinc-500 mb-6 font-mono leading-relaxed">
        ⌕ 相場データベースは、Chrome拡張機能で集めた成約価格・買取相場の調査記録です。
        タグで絞り込めば「緑文字盤×フルセット」のような特定条件の中央値が見えます。
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
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">⌕</span>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5">調査元</label>
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
            <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5">価格タイプ</label>
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

        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5">期間</label>
          <div className="flex gap-1 bg-zinc-900/60 border border-zinc-800 rounded-md p-1">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.days}
                type="button"
                onClick={() => setDaysAgo(opt.days)}
                className={`
                  flex-1 px-2 py-1.5 text-[11px] uppercase tracking-wider rounded transition-colors
                  ${daysAgo === opt.days ? "bg-blue-500/15 text-blue-300" : "text-zinc-500 hover:text-zinc-300"}
                `}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5">回転率 (出品から売却までの日数)</label>
          <div className="flex gap-1 bg-zinc-900/60 border border-zinc-800 rounded-md p-1">
            {TURNOVER_OPTIONS.map(opt => (
              <button
                key={String(opt.maxDays)}
                type="button"
                onClick={() => setMaxTurnover(opt.maxDays)}
                className={`
                  flex-1 px-2 py-1.5 text-[11px] uppercase tracking-wider rounded transition-colors
                  ${maxTurnover === opt.maxDays ? "bg-emerald-500/15 text-emerald-300" : "text-zinc-500 hover:text-zinc-300"}
                `}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ===== タグクラウド & 絞り込み ===== */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              🏷️ タグで絞り込み
              {activeTags.size > 0 && (
                <span className="ml-2 text-blue-400">
                  ({activeTags.size}個 選択中・AND検索)
                </span>
              )}
            </label>
            <button
              type="button"
              onClick={() => setShowAllTags(v => !v)}
              className="text-[10px] text-blue-400/80 hover:text-blue-300"
            >
              {showAllTags ? "▲ 閉じる" : "▼ 全タグ表示"}
            </button>
          </div>

          {/* 選択中のタグ (常に最上段に表示) */}
          {activeTags.size > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-2 border-b border-zinc-800">
              {[...activeTags].map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="
                    px-2.5 py-1 rounded-full text-[11px] font-medium
                    bg-blue-500 text-zinc-950 border border-blue-400
                    hover:bg-blue-400
                    transition-colors
                  "
                >
                  ✓ {tag} ✕
                </button>
              ))}
            </div>
          )}

          {/* 頻出タグ (デフォルト表示) */}
          {!showAllTags && (
            <>
              {topTags.length === 0 && activeTags.size === 0 ? (
                <p className="text-[11px] text-zinc-600 italic">
                  タグ付きデータがまだありません
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {topTags
                    .filter(({ tag }) => !activeTags.has(tag))
                    .map(({ tag, count }) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className="
                          px-2 py-0.5 rounded-full text-[11px]
                          bg-zinc-800 text-zinc-300 border border-zinc-700
                          hover:bg-blue-500/15 hover:border-blue-500/40 hover:text-blue-300
                          transition-colors
                        "
                      >
                        {tag}
                        <span className="ml-1 text-zinc-500">·{count}</span>
                      </button>
                    ))}
                </div>
              )}
            </>
          )}

          {/* 全タグ展開 (カテゴリ別) */}
          {showAllTags && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {TAG_CATEGORIES.map(cat => (
                <div key={cat.label}>
                  <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">
                    {cat.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.tags.map(tag => {
                      const count = tagFrequency[tag] ?? 0;
                      const isActive = activeTags.has(tag);
                      const dim = count === 0 && !isActive;
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          disabled={dim}
                          className={`
                            px-2 py-0.5 rounded-full text-[10px]
                            border transition-colors
                            ${isActive
                              ? "bg-blue-500 text-zinc-950 border-blue-400"
                              : dim
                                ? "bg-zinc-900/40 text-zinc-700 border-zinc-900 cursor-not-allowed"
                                : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-blue-500/15 hover:border-blue-500/40 hover:text-blue-300"
                            }
                          `}
                          title={count > 0 ? `${count}件` : "該当データなし"}
                        >
                          {tag}
                          {count > 0 && <span className="ml-1 opacity-70">·{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery(""); setChannel(""); setPriceType("");
              setMaxTurnover(null); setActiveTags(new Set());
            }}
            className="text-xs text-zinc-500 hover:text-blue-300 transition-colors"
          >
            ✕ すべてのフィルタをクリア
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
            subtext={activeTags.size > 0 ? `タグ${activeTags.size}個で絞込み済み` : "目利きの目安"}
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
          {hasFilters && (
            <p className="text-xs mt-2 text-zinc-600">フィルタを緩めると結果が出るかもしれません</p>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <section className="space-y-2">
          {filtered.map((w) => (
            <MarketRow
              key={w.id}
              watch={w}
              q1Threshold={q1}
              activeTags={activeTags}
              onTagClick={toggleTag}
            />
          ))}
        </section>
      )}
    </>
  );
}
