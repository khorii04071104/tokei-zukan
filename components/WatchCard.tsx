import { Watch, RarityRank, calcProfit, calcProfitRate } from "@/lib/supabase";

// ============================================
// レアリティバッジの色定義
// ============================================
const RARITY_STYLES: Record<RarityRank, { bg: string; text: string; ring: string; label: string }> = {
  SS: {
    bg: "bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500",
    text: "text-zinc-900",
    ring: "ring-amber-300/40",
    label: "SS"
  },
  A: {
    bg: "bg-gradient-to-br from-zinc-200 via-zinc-300 to-zinc-400",
    text: "text-zinc-900",
    ring: "ring-zinc-200/30",
    label: "A"
  },
  B: {
    bg: "bg-gradient-to-br from-amber-700 via-amber-800 to-yellow-900",
    text: "text-amber-100",
    ring: "ring-amber-700/30",
    label: "B"
  },
  C: {
    bg: "bg-gradient-to-br from-zinc-600 via-zinc-700 to-zinc-800",
    text: "text-zinc-100",
    ring: "ring-zinc-500/20",
    label: "C"
  }
};

// 円フォーマッタ
const yen = (n: number) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(n);

// ============================================
// コンポーネント
// ============================================
type Props = { watch: Watch };

export default function WatchCard({ watch }: Props) {
  const profit = calcProfit(watch);
  const profitRate = calcProfitRate(watch);
  const isSold = watch.sale_price != null;
  const rarity = watch.rarity_rank ? RARITY_STYLES[watch.rarity_rank] : null;

  return (
    <article
      className="
        group relative overflow-hidden rounded-xl
        bg-gradient-to-br from-zinc-900 via-zinc-900 to-black
        border border-zinc-800
        hover:border-amber-500/40 hover:shadow-[0_0_40px_-10px_rgba(212,165,116,0.4)]
        transition-all duration-300
      "
    >
      {/* 上部の細いゴールドアクセントライン */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />

      {/* ホバー時のシマー光沢 */}
      <div className="
        pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100
        bg-[radial-gradient(circle_at_30%_-20%,rgba(212,165,116,0.15),transparent_60%)]
        transition-opacity duration-500
      " />

      <div className="relative p-5 space-y-4">
        {/* ヘッダー: ブランド名 + レアリティ */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.25em] text-amber-500/70 mb-1">
              {isSold ? "Sold" : "In Stock"}
            </p>
            <h3 className="font-serif text-xl text-amber-50 truncate">
              {watch.brand}
            </h3>
          </div>

          {rarity && (
            <span
              className={`
                shrink-0 inline-flex items-center justify-center
                w-9 h-9 rounded-full font-serif text-sm font-bold
                ${rarity.bg} ${rarity.text}
                ring-1 ${rarity.ring}
                shadow-lg
              `}
              title={`Rarity: ${rarity.label}`}
            >
              {rarity.label}
            </span>
          )}
        </div>

        {/* モデル名 */}
        <div className="space-y-1">
          <p className="text-sm text-zinc-300 line-clamp-2 leading-relaxed min-h-[2.5rem]">
            {watch.model_name}
          </p>
          {watch.ref_number && (
            <p className="text-xs font-mono text-zinc-500 tracking-wide">
              Ref. {watch.ref_number}
            </p>
          )}
        </div>

        {/* 区切り線 */}
        <div className="h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />

        {/* 価格情報 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">仕入</p>
            <p className="text-base font-mono text-zinc-200">{yen(watch.purchase_price)}</p>
          </div>

          {isSold ? (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">販売</p>
              <p className="text-base font-mono text-zinc-200">{yen(watch.sale_price!)}</p>
            </div>
          ) : (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">仕入日</p>
              <p className="text-xs font-mono text-zinc-400">{watch.stock_date}</p>
            </div>
          )}
        </div>

        {/* 利益 (売却済みのみ) */}
        {isSold && profit != null && (
          <div className="rounded-lg bg-zinc-950/60 border border-zinc-800 px-3 py-2 flex items-baseline justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Profit</span>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-lg font-mono font-bold ${
                  profit >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {profit >= 0 ? "+" : ""}{yen(profit)}
              </span>
              {profitRate != null && (
                <span className="text-xs font-mono text-zinc-500">
                  ({(profitRate * 100).toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        )}

        {/* チャネル (売却済み) */}
        {isSold && watch.channel && (
          <p className="text-[11px] text-zinc-500 tracking-wider">
            via <span className="text-amber-500/80">{watch.channel}</span>
          </p>
        )}
      </div>
    </article>
  );
}
