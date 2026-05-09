"use client";

import { Watch } from "@/lib/supabase";

const yen = (n: number) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(n);

const PRICE_TYPE_LABELS: Record<string, string> = {
  sold: "成約",
  buyback: "買取"
};

function turnoverBadge(days: number | null) {
  if (days == null) return null;
  if (days <= 7)  return { label: `⚡ ${days}日で売却`,  color: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" };
  if (days <= 30) return { label: `${days}日で売却`,    color: "bg-amber-500/15 text-amber-300 border border-amber-500/30" };
  if (days <= 90) return { label: `△ ${days}日で売却`,  color: "bg-orange-500/15 text-orange-300 border border-orange-500/30" };
  return                 { label: `🐢 ${days}日で売却`,  color: "bg-rose-500/15 text-rose-400 border border-rose-500/30" };
}

function soldWithinBadge(days: number | null) {
  if (days == null) return null;
  return { label: `〜${days}日以内`, color: "bg-zinc-800 text-zinc-400 border border-zinc-700" };
}

type Props = {
  watch: Watch;
  q1Threshold?: number;
  activeTags?: Set<string>;
  onTagClick?: (tag: string) => void;
  onClick?: (w: Watch) => void;
};

export default function MarketRow({
  watch,
  q1Threshold = 0,
  activeTags,
  onTagClick,
  onClick
}: Props) {
  const price = watch.sale_price ?? 0;
  const isOutlier = q1Threshold > 0 && price < q1Threshold;
  const priceTypeLabel = watch.price_type ? PRICE_TYPE_LABELS[watch.price_type] : "";

  const turnover = turnoverBadge(watch.days_to_sell) || soldWithinBadge(watch.sold_within_days);
  const tags = watch.tags || [];

  function handleTagClick(e: React.MouseEvent, tag: string) {
    e.preventDefault();
    e.stopPropagation();
    onTagClick?.(tag);
  }

  function handleRowClick() {
    onClick?.(watch);
  }

  return (
    <button
      type="button"
      onClick={handleRowClick}
      className={`
        group block w-full text-left rounded-lg
        bg-gradient-to-r from-zinc-900/60 to-zinc-900/30
        border ${isOutlier ? "border-zinc-900 opacity-50" : "border-zinc-800"}
        hover:border-blue-500/40 hover:from-zinc-900 hover:to-zinc-900/60
        active:scale-[0.998]
        transition-all duration-200
        cursor-pointer
      `}
      style={{ WebkitTapHighlightColor: "rgba(127, 160, 219, 0.2)" }}
    >
      <div className="flex items-stretch gap-3 p-3">
        {/* 画像 */}
        <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 bg-black rounded-md overflow-hidden border border-zinc-800">
          {watch.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={watch.image_url}
              alt={watch.brand}
              className="w-full h-full object-contain pointer-events-none"
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">
              ⌚
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="font-serif text-sm sm:text-base text-amber-50 truncate">
                {watch.brand}
              </h3>
              {watch.ref_number && (
                <span className="text-[10px] font-mono text-zinc-500 truncate">
                  Ref. {watch.ref_number}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 truncate">
              {watch.model_name}
            </p>
          </div>

          <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[10px]">
            {watch.channel && (
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                {watch.channel}
              </span>
            )}
            {priceTypeLabel && (
              <span className={`
                px-2 py-0.5 rounded font-mono
                ${watch.price_type === "sold"
                  ? "bg-blue-500/15 text-blue-300"
                  : "bg-amber-500/15 text-amber-300"}
              `}>
                {priceTypeLabel}
              </span>
            )}
            {turnover && (
              <span className={`px-2 py-0.5 rounded font-mono ${turnover.color}`}>
                {turnover.label}
              </span>
            )}
            {watch.surveyed_at && (
              <span className="text-zinc-600 font-mono">
                {watch.surveyed_at}
              </span>
            )}
            {isOutlier && (
              <span className="text-rose-400/80 font-mono">⚠ 安売り疑い</span>
            )}

            {/* タグバッジ (クリックで絞り込みトグル、行クリックは止める) */}
            {tags.length > 0 && tags.map(tag => {
              const isActive = activeTags?.has(tag) ?? false;
              return (
                <span
                  key={tag}
                  onClick={(e) => handleTagClick(e, tag)}
                  className={`
                    px-2 py-0.5 rounded-full
                    transition-colors cursor-pointer
                    ${isActive
                      ? "bg-blue-500 text-zinc-950 border border-blue-400 font-medium"
                      : "bg-blue-500/10 text-blue-300 border border-blue-500/30 hover:bg-blue-500/20 hover:border-blue-500/50"
                    }
                  `}
                  title={isActive ? "クリックでフィルタ解除" : "クリックでこのタグでフィルタ"}
                >
                  {isActive && "✓ "}{tag}
                </span>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end justify-center min-w-[90px]">
          <p className={`font-mono text-base sm:text-lg font-bold ${isOutlier ? "text-zinc-500" : "text-zinc-100"}`}>
            {yen(price)}
          </p>
          <span className="text-[9px] text-zinc-600 group-hover:text-blue-300 transition-colors mt-0.5 pointer-events-none">
            詳細 →
          </span>
        </div>
      </div>
    </button>
  );
}
