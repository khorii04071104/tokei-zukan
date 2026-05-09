"use client";

import { useEffect, useState } from "react";
import { Watch, deleteWatch } from "@/lib/supabase";

const yen = (n: number) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(n);

const PRICE_TYPE_LABELS: Record<string, string> = {
  sold: "成約価格",
  buyback: "買取相場"
};

type Props = {
  watch: Watch;
  onClose: () => void;
  onDeleted: (id: string) => void;
};

export default function MarketDeleteModal({ watch, onClose, onDeleted }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      await deleteWatch(watch.id);
      onDeleted(watch.id);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`削除失敗: ${msg}`);
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="
        relative w-full max-w-xl max-h-[90vh] overflow-y-auto
        bg-gradient-to-br from-zinc-900 via-zinc-900 to-black
        border border-zinc-800 rounded-xl
        shadow-[0_0_60px_-10px_rgba(127,160,219,0.3)]
      ">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/60 to-transparent" />

        {/* ヘッダー */}
        <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.25em] text-blue-300/70 mb-1">
              Market Record
            </p>
            <h2 className="font-serif text-2xl text-blue-50 truncate">
              {watch.brand}
            </h2>
            <p className="text-sm text-zinc-400 truncate">{watch.model_name}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 shrink-0 w-9 h-9 rounded-full text-zinc-500 hover:text-blue-400 hover:bg-zinc-800/60 transition-colors text-xl"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* 商品画像 */}
          {watch.image_url && (
            <div className="rounded-lg overflow-hidden bg-black border border-zinc-800 max-h-60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={watch.image_url}
                alt={watch.brand}
                className="w-full h-full object-contain max-h-60"
                onError={(e) => {
                  const wrap = (e.currentTarget as HTMLImageElement).parentElement;
                  if (wrap) wrap.style.display = "none";
                }}
              />
            </div>
          )}

          {/* 価格 */}
          <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-blue-300/80 mb-1">
              {watch.price_type ? PRICE_TYPE_LABELS[watch.price_type] : "価格"}
              {watch.channel && <span className="ml-2 text-zinc-500">via {watch.channel}</span>}
            </p>
            <p className="font-mono text-3xl font-bold text-blue-100">
              {yen(watch.sale_price ?? 0)}
            </p>
          </div>

          {/* 詳細メタ情報 */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {watch.ref_number && (
              <Field label="型番" value={watch.ref_number} />
            )}
            {watch.surveyed_at && (
              <Field label="調査日" value={watch.surveyed_at} />
            )}
            {watch.listed_at && (
              <Field label="出品日" value={watch.listed_at} />
            )}
            {watch.sold_date && (
              <Field label="売却日" value={watch.sold_date} />
            )}
            {watch.days_to_sell != null && (
              <Field label="売却までの日数" value={`${watch.days_to_sell}日`} />
            )}
            {watch.sold_within_days != null && (
              <Field label="売却バッジ" value={`${watch.sold_within_days}日以内`} />
            )}
          </div>

          {/* タグ */}
          {watch.tags && watch.tags.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">タグ</p>
              <div className="flex flex-wrap gap-1.5">
                {watch.tags.map(t => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 text-xs border border-blue-500/30"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* メモ */}
          {watch.memo && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">メモ</p>
              <pre className="
                whitespace-pre-wrap break-words
                text-xs text-zinc-300 font-mono leading-relaxed
                bg-zinc-950/50 border border-zinc-800 rounded-md p-3
                max-h-40 overflow-y-auto
              ">
                {watch.memo}
              </pre>
            </div>
          )}

          {/* 元ページへのリンク */}
          {watch.source_url && (
            <a
              href={watch.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="
                block w-full text-center
                px-4 py-2.5 text-sm
                bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-blue-500/50
                text-zinc-300 hover:text-blue-300
                rounded-md transition-colors
              "
            >
              🔗 元ページを新しいタブで開く
            </a>
          )}

          {/* エラー */}
          {error && (
            <div className="rounded-lg bg-rose-950/40 border border-rose-900 text-rose-200 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* ボタン */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-zinc-800">
            {/* 削除ボタン */}
            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                disabled={deleting}
                className="text-xs text-zinc-600 hover:text-rose-400 transition-colors self-start sm:self-auto"
              >
                このデータを削除...
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-300">本当に削除しますか?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1 text-xs bg-rose-600 hover:bg-rose-500 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  {deleting ? "削除中..." : "削除する"}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                  className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  やめる
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              disabled={deleting}
              className="px-5 py-2 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-md transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-950/40 border border-zinc-800 rounded-md px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">{label}</p>
      <p className="text-sm text-zinc-200 font-mono truncate">{value}</p>
    </div>
  );
}
