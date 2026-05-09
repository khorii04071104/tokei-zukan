import { Watch, RarityRank, calcProfit, calcProfitRate } from "@/lib/supabase";

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

const yen = (n: number) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(n);

type Props = {
  watch: Watch;
  onClick?: (w: Watch) => void;
};

export default function WatchCard({ watch, onClick }: Props) {
  const profit = calcProfit(watch);
  const profitRate = calcProfitRate(watch);
  const isSold = watch.sale_price != null;
  const rarity = watch.rarity_rank ? RARITY_STYLES[watch.rarity_rank] : null;
  const hasImage = !!watch.image_url;

  // クリックハンドラ (PC/スマホ両対応)
  const handleActivate = () => onClick?.(watch);

  return (
    // iOS Safari でも確実にタップが効くように <button> でラップ
    // form要素ではないので type="button" を明示してフォーム送信を防ぐ
    <button
      type="button"
      onClick={handleActivate}
      className="
        group relative overflow-hidden rounded-xl text-left w-full
        bg-gradient-to-br from-zinc-900 via-zinc-900 to-black
        border border-zinc-800
        hover:border-amber-500/40 hover:shadow-[0_0_40px_-10px_rgba(212,165,116,0.4)]
        active:scale-[0.99]
        transition-all duration-300
        focus:outline-none focus-visible:border-amber-500/60
        cursor-pointer
      "
      style={{
        // iOS Safari でハイライト色をカスタム
        WebkitTapHighlightColor: "rgba(212, 165, 116, 0.2)"
      }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent z-10 pointer-events-none" />
      <div className="
        pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100
        bg-[radial-gradient(circle_at_30%_-20%,rgba(212,165,116,0.15),transparent_60%)]
        transition-opacity duration-500 z-10
      " />

      {/* ホバー時に左上に "編集" 表示 (PCのみ実質表示。タッチデバイスではホバーがないので非表示) */}
      <div className="
        absolute top-3 left-3 z-20 opacity-0 group-hover:opacity-100
        transition-opacity duration-200
        text-[10px] uppercase tracking-[0.2em] text-amber-400
        bg-zinc-950/80 backdrop-blur px-2 py-1 rounded-md border border-amber-500/30
        pointer-events-none
      ">
        ✎ 編集
      </div>

      {hasImage && (
        <div className="relative w-full h-48 bg-black overflow-hidden border-b border-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={watch.image_url!}
            alt={`${watch.brand} ${watch.model_name}`}
            className="absolute inset-0 w-full h-full object-contain transition-transform duration-500 group-hover:scale-105 pointer-events-none"
            loading="lazy"
            onError={(e) => {
              const wrapper = (e.currentTarget as HTMLImageElement).parentElement;
              if (wrapper) wrapper.style.display = "none";
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none" />

          {rarity && (
            <span
              className={`
                absolute top-3 right-3 z-20
                inline-flex items-center justify-center
                w-9 h-9 rounded-full font-serif text-sm font-bold
                ${rarity.bg} ${rarity.text}
                ring-1 ${rarity.ring}
                shadow-lg pointer-events-none
              `}
              title={`Rarity: ${rarity.label}`}
            >
              {rarity.label}
            </span>
          )}
        </div>
      )}

      <div className="relative p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.25em] text-amber-500/70 mb-1">
              {isSold ? "Sold" : "In Stock"}
            </p>
            <h3 className="font-serif text-xl text-amber-50 truncate">
              {watch.brand}
            </h3>
          </div>

          {!hasImage && rarity && (
            <span
              className={`
                shrink-0 inline-flex items-center justify-center
                w-9 h-9 rounded-full font-serif text-sm font-bold
                ${rarity.bg} ${rarity.text}
                ring-1 ${rarity.ring}
                shadow-lg pointer-events-none
              `}
              title={`Rarity: ${rarity.label}`}
            >
              {rarity.label}
            </span>
          )}
        </div>

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

        <div className="h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />

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

        {isSold && watch.channel && (
          <p className="text-[11px] text-zinc-500 tracking-wider">
            via <span className="text-amber-500/80">{watch.channel}</span>
            {watch.sold_date && (
              <span className="text-zinc-600 font-mono"> · {watch.sold_date}</span>
            )}
          </p>
        )}
      </div>
    </button>
  );
}
