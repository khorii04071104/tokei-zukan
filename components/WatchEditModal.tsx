"use client";

import { useEffect, useState } from "react";
import {
  Watch,
  WatchUpdate,
  CHANNELS,
  updateWatch,
  deleteWatch,
  calcProfit,
  calcProfitRate,
  getFeeRate
} from "@/lib/supabase";

const yen = (n: number) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(n);

type Props = {
  watch: Watch;
  onClose: () => void;
  onSaved: (updated: Watch) => void;
  onDeleted: (id: string) => void;
};

export default function WatchEditModal({ watch, onClose, onSaved, onDeleted }: Props) {
  // 編集中の値をローカル state で持つ
  const [purchasePrice, setPurchasePrice] = useState<string>(String(watch.purchase_price));
  const [batteryCost,   setBatteryCost]   = useState<string>(String(watch.battery_cost));
  const [shippingFee,   setShippingFee]   = useState<string>(String(watch.shipping_fee));
  const [salePrice,     setSalePrice]     = useState<string>(watch.sale_price != null ? String(watch.sale_price) : "");
  const [channel,       setChannel]       = useState<string>(watch.channel ?? "");
  const [soldDate,      setSoldDate]      = useState<string>(watch.sold_date ?? "");
  const [memo,          setMemo]          = useState<string>(watch.memo ?? "");

  const [saving, setSaving]               = useState(false);
  const [confirmingDelete, setConfirming] = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  // ESC キーで閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden"; // 背面スクロール無効化
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // ---- 計算プレビュー (現在のフォーム入力ベースで利益を表示) ----
  const previewSale = salePrice ? parseInt(salePrice, 10) : null;
  const previewWatch: Watch = {
    ...watch,
    purchase_price: parseInt(purchasePrice, 10) || 0,
    battery_cost:   parseInt(batteryCost, 10)   || 0,
    shipping_fee:   parseInt(shippingFee, 10)   || 0,
    sale_price:     previewSale,
    channel:        channel || null
  };
  const previewProfit = calcProfit(previewWatch);
  const previewRate   = calcProfitRate(previewWatch);
  const feeRate       = getFeeRate(channel || null);

  // ---- 保存 ----
  async function handleSave() {
    setError(null);

    // バリデーション
    const pp = parseInt(purchasePrice, 10);
    if (isNaN(pp) || pp < 0) { setError("仕入価格が不正です"); return; }

    const bc = parseInt(batteryCost, 10);
    const sf = parseInt(shippingFee, 10);
    if (isNaN(bc) || bc < 0) { setError("電池代が不正です"); return; }
    if (isNaN(sf) || sf < 0) { setError("送料が不正です"); return; }

    // 売却関連は3点セット (全部入っているか、全部空か)
    const sp = salePrice ? parseInt(salePrice, 10) : null;
    const hasAnySale = !!salePrice || !!channel || !!soldDate;
    const hasAllSale = !!salePrice && !!channel && !!soldDate;
    if (hasAnySale && !hasAllSale) {
      setError("売却情報は「販売価格・チャネル・売却日」をすべて入力するか、すべて空にしてください");
      return;
    }
    if (sp != null && (isNaN(sp) || sp < 0)) {
      setError("販売価格が不正です");
      return;
    }

    const patch: WatchUpdate = {
      purchase_price: pp,
      battery_cost:   bc,
      shipping_fee:   sf,
      sale_price:     sp,
      channel:        channel || null,
      sold_date:      soldDate || null,
      memo:           memo.trim() || null
    };

    setSaving(true);
    try {
      const updated = await updateWatch(watch.id, patch);
      onSaved(updated);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`保存失敗: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  // ---- 売却情報をクリア ----
  function clearSaleInfo() {
    setSalePrice("");
    setChannel("");
    setSoldDate("");
  }

  // ---- 今日の日付を入れる ----
  function setToday() {
    setSoldDate(new Date().toISOString().slice(0, 10));
  }

  // ---- 削除 ----
  async function handleDelete() {
    setError(null);
    setSaving(true);
    try {
      await deleteWatch(watch.id);
      onDeleted(watch.id);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`削除失敗: ${msg}`);
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        // 背景クリックで閉じる (パネルクリックは無視)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="
        relative w-full max-w-2xl max-h-[90vh] overflow-y-auto
        bg-gradient-to-br from-zinc-900 via-zinc-900 to-black
        border border-zinc-800 rounded-xl
        shadow-[0_0_60px_-10px_rgba(212,165,116,0.3)]
      ">
        {/* 上部のゴールドアクセント */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />

        {/* ヘッダー */}
        <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.25em] text-amber-500/70 mb-1">
              Edit Entry
            </p>
            <h2 className="font-serif text-2xl text-amber-50 truncate">
              {watch.brand}
            </h2>
            <p className="text-sm text-zinc-400 truncate">{watch.model_name}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 shrink-0 w-9 h-9 rounded-full text-zinc-500 hover:text-amber-400 hover:bg-zinc-800/60 transition-colors text-xl"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* === 売却情報セクション === */}
          <section className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg text-amber-300">💰 売却情報</h3>
              {(salePrice || channel || soldDate) && (
                <button
                  type="button"
                  onClick={clearSaleInfo}
                  className="text-xs text-zinc-500 hover:text-rose-400 transition-colors"
                >
                  未売却に戻す
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="販売価格 (円)">
                <input
                  type="number"
                  min="0"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="例: 25000"
                  className={inputClass}
                />
              </Field>

              <Field label="売却チャネル">
                <div className="flex gap-2">
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className={inputClass + " flex-1"}
                  >
                    <option value="">-- 選択 --</option>
                    {CHANNELS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </Field>

              <Field label="売却日">
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={soldDate}
                    onChange={(e) => setSoldDate(e.target.value)}
                    className={inputClass + " flex-1"}
                  />
                  <button
                    type="button"
                    onClick={setToday}
                    className="px-3 text-xs text-amber-400 hover:bg-amber-500/10 rounded-md border border-amber-500/30 whitespace-nowrap transition-colors"
                  >
                    今日
                  </button>
                </div>
              </Field>

              <Field label={`手数料率 (自動)`}>
                <div className="px-3 py-2 bg-zinc-950/50 border border-zinc-800 rounded-md text-zinc-400 font-mono text-sm">
                  {(feeRate * 100).toFixed(1)}%
                </div>
              </Field>
            </div>

            {/* 利益プレビュー */}
            {previewProfit != null && (
              <div className="pt-3 mt-3 border-t border-amber-500/15">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">利益プレビュー</span>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-mono font-bold ${
                      previewProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}>
                      {previewProfit >= 0 ? "+" : ""}{yen(previewProfit)}
                    </span>
                    {previewRate != null && (
                      <span className="text-xs font-mono text-zinc-500">
                        ({(previewRate * 100).toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-zinc-600 mt-1 font-mono">
                  販売価格 − 仕入 − 電池代 − 送料 − 手数料({(feeRate * 100).toFixed(1)}%)
                </p>
              </div>
            )}
          </section>

          {/* === 仕入情報セクション === */}
          <section className="space-y-4">
            <h3 className="font-serif text-lg text-zinc-300">📦 仕入・コスト情報</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="仕入価格 (円)">
                <input
                  type="number"
                  min="0"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="電池代 (円)">
                <input
                  type="number"
                  min="0"
                  value={batteryCost}
                  onChange={(e) => setBatteryCost(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="送料 (円)">
                <input
                  type="number"
                  min="0"
                  value={shippingFee}
                  onChange={(e) => setShippingFee(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="メモ・真贋ポイント">
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
                className={inputClass + " resize-y"}
              />
            </Field>
          </section>

          {/* エラー */}
          {error && (
            <div className="rounded-lg bg-rose-950/40 border border-rose-900 text-rose-200 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* === ボタン === */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-zinc-800">
            {/* 削除 */}
            {!confirmingDelete ? (
              <button
                onClick={() => setConfirming(true)}
                disabled={saving}
                className="text-xs text-zinc-600 hover:text-rose-400 transition-colors self-start sm:self-auto"
              >
                この時計を削除...
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-300">本当に削除しますか?</span>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-3 py-1 text-xs bg-rose-600 hover:bg-rose-500 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  削除する
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={saving}
                  className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  やめる
                </button>
              </div>
            )}

            {/* 保存・キャンセル */}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-5 py-2 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-md transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="
                  px-6 py-2 text-sm font-semibold
                  bg-gradient-to-r from-amber-500 to-amber-600
                  hover:from-amber-400 hover:to-amber-500
                  text-zinc-950 rounded-md
                  transition-all
                  disabled:opacity-50 disabled:cursor-wait
                  shadow-[0_0_20px_-5px_rgba(212,165,116,0.5)]
                "
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 共通サブコンポーネント
// ============================================
const inputClass = `
  w-full px-3 py-2
  bg-zinc-950/50 border border-zinc-800 rounded-md
  text-zinc-100 placeholder:text-zinc-600
  text-sm font-mono
  focus:outline-none focus:border-amber-500/60 focus:bg-zinc-900
  transition-colors
`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
