import { Watch } from "@/lib/supabase";

const yen = (n: number) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(n);

const PRICE_TYPE_LABELS: Record<string, string> = {
  sold: "成約",
  buyback: "買取"
};

type Props = {
  watch: Watch;
  q1Threshold?: number;  // この値未満は外れ値疑い
};

export default function MarketRow({ watch, q1Threshold = 0 }: Props) {
  const price = watch.sale_price ?? 0;
  const isOutlier = q1Threshold > 0 && price < q1Threshold;
  const priceTypeLabel = watch.price_type ? PRICE_TYPE_LABELS[watch.price_type] : "";

  return (
    <a
      href={watch.source_url || "#"}
      target={watch.source_url ? "_blank" : undefined}
      rel="noopener noreferrer"
      className={`
        group block rounded-lg
        bg-gradient-to-r from-zinc-900/60 to-zinc-900/30
        border ${isOutlier ? "border-zinc-900 opacity-50" : "border-zinc-800"}
        hover:border-blue-500/40 hover:from-zinc-900 hover:to-zinc-900/60
        transition-all duration-200
      `}
    >
      <div className="flex items-stretch gap-3 p-3">
        {/* 画像 */}
        <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 bg-black rounded-md overflow-hidden border border-zinc-800">
          {watch.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={watch.image_url}
              alt={watch.brand}
              className="w-full h-full object-contain"
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

        {/* 情報 */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          {/* 上段: ブランド・モデル */}
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

          {/* 下段: メタ情報 */}
          <div className="flex items-center gap-2 mt-1 flex-wrap text-[10px]">
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
            {watch.surveyed_at && (
              <span className="text-zinc-600 font-mono">
                {watch.surveyed_at}
              </span>
            )}
            {isOutlier && (
              <span className="text-rose-400/80 font-mono">
                ⚠ 安売り疑い
              </span>
            )}
          </div>
        </div>

        {/* 価格 */}
        <div className="shrink-0 flex flex-col items-end justify-center min-w-[90px]">
          <p className={`font-mono text-base sm:text-lg font-bold ${isOutlier ? "text-zinc-500" : "text-zinc-100"}`}>
            {yen(price)}
          </p>
          {watch.source_url && (
            <span className="text-[9px] text-blue-400/60 group-hover:text-blue-300 transition-colors mt-0.5">
              元ページ →
            </span>
          )}
        </div>
      </div>
    </a>
  );
}
