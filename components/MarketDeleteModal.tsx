"use client";

import { useEffect, useState } from "react";
import { Watch, deleteWatch, updateWatch } from "@/lib/supabase";
import { TAG_CATEGORIES, ALL_TAGS } from "@/lib/tagVocabulary";

const yen = (n: number) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(n);

const PRICE_TYPE_LABELS: Record<string, string> = {
  sold: "成約価格",
  buyback: "買取相場"
};

function sanitizeNormalizedId(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

type Props = {
  watch: Watch;
  onClose: () => void;
  onDeleted: (id: string) => void;
  onUpdated?: (updated: Watch) => void;
};

export default function MarketDeleteModal({ watch, onClose, onDeleted, onUpdated }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // === 編集可能フィールド ===
  // 元データの値を保持しつつ、編集中は draft を使う
  const [modelNameSaved, setModelNameSaved] = useState(watch.model_name);
  const [modelNameDraft, setModelNameDraft] = useState(watch.model_name);
  const [editingModelName, setEditingModelName] = useState(false);

  const [refNumberSaved, setRefNumberSaved] = useState(watch.ref_number);
  const [refNumberDraft, setRefNumberDraft] = useState(watch.ref_number ?? "");
  const [editingRefNumber, setEditingRefNumber] = useState(false);

  const [normalizedSaved, setNormalizedSaved] = useState<string | null>(watch.model_name_normalized);
  const [normalizedDraft, setNormalizedDraft] = useState(watch.model_name_normalized ?? "");
  const [editingNormalized, setEditingNormalized] = useState(false);

  // タグ編集
  const [tagsSaved, setTagsSaved] = useState<string[]>(watch.tags ?? []);
  const [editingTags, setEditingTags] = useState(false);
  const [tagsDraft, setTagsDraft] = useState<Set<string>>(new Set(watch.tags ?? []));
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [customTagInput, setCustomTagInput] = useState("");

  const [saving, setSaving] = useState(false);

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

  // 統一的なフィールド更新関数
  async function saveField(
    field: "model_name" | "ref_number" | "model_name_normalized",
    value: string | null
  ): Promise<boolean> {
    setError(null);
    setSaving(true);
    try {
      // updateWatch の WatchUpdate 型に合わせる
      const patch: Record<string, string | null> = { [field]: value };
      const updated = await updateWatch(watch.id, patch as never);
      if (onUpdated) onUpdated(updated);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`更新失敗: ${msg}`);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveModelName() {
    const trimmed = modelNameDraft.trim();
    if (!trimmed) {
      setError("モデル名は空にできません");
      return;
    }
    if (trimmed === modelNameSaved) {
      setEditingModelName(false);
      return;
    }
    const ok = await saveField("model_name", trimmed);
    if (ok) {
      setModelNameSaved(trimmed);
      setEditingModelName(false);
    }
  }

  async function handleSaveRefNumber() {
    const trimmed = refNumberDraft.trim();
    const value = trimmed || null;
    if (value === refNumberSaved) {
      setEditingRefNumber(false);
      return;
    }
    const ok = await saveField("ref_number", value);
    if (ok) {
      setRefNumberSaved(value);
      setRefNumberDraft(value ?? "");
      setEditingRefNumber(false);
    }
  }

  async function handleSaveNormalized() {
    const sanitized = sanitizeNormalizedId(normalizedDraft);
    const value = sanitized || null;
    if (value === normalizedSaved) {
      setEditingNormalized(false);
      return;
    }
    const ok = await saveField("model_name_normalized", value);
    if (ok) {
      setNormalizedSaved(value);
      setNormalizedDraft(sanitized);
      setEditingNormalized(false);
    }
  }

  // === タグ操作 ===
  function toggleTagInDraft(tag: string) {
    setTagsDraft(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function addCustomTag() {
    const v = customTagInput.trim();
    if (!v) return;
    setTagsDraft(prev => new Set([...prev, v]));
    setCustomTagInput("");
  }

  async function handleSaveTags() {
    setError(null);
    const newTags = [...tagsDraft];
    setSaving(true);
    try {
      // updateWatch は WatchUpdate 型を要求するので tags フィールドで更新
      const updated = await updateWatch(watch.id, { tags: newTags });
      setTagsSaved(newTags);
      setEditingTags(false);
      setShowTagPicker(false);
      if (onUpdated) onUpdated(updated);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`タグ更新失敗: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  function cancelTagEdit() {
    setTagsDraft(new Set(tagsSaved));
    setEditingTags(false);
    setShowTagPicker(false);
    setCustomTagInput("");
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

        <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.25em] text-blue-300/70 mb-1">
              Market Record
            </p>
            <h2 className="font-serif text-2xl text-blue-50 truncate">
              {watch.brand}
            </h2>
            <p className="text-sm text-zinc-400 truncate">{modelNameSaved}</p>
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

          <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-blue-300/80 mb-1">
              {watch.price_type ? PRICE_TYPE_LABELS[watch.price_type] : "価格"}
              {watch.channel && <span className="ml-2 text-zinc-500">via {watch.channel}</span>}
            </p>
            <p className="font-mono text-3xl font-bold text-blue-100">
              {yen(watch.sale_price ?? 0)}
            </p>
          </div>

          {/* === 編集可能フィールド: モデル名 === */}
          <EditableField
            label="モデル名"
            value={modelNameSaved}
            placeholder="例: Mr.Daddy"
            isEditing={editingModelName}
            draft={modelNameDraft}
            saving={saving}
            onStartEdit={() => setEditingModelName(true)}
            onChangeDraft={setModelNameDraft}
            onSave={handleSaveModelName}
            onCancel={() => {
              setModelNameDraft(modelNameSaved);
              setEditingModelName(false);
            }}
          />

          {/* === 編集可能フィールド: 型番 === */}
          <EditableField
            label="型番"
            value={refNumberSaved ?? ""}
            placeholder="例: DZ7314 / 116610LV (任意)"
            emptyText="(未設定)"
            isEditing={editingRefNumber}
            draft={refNumberDraft}
            saving={saving}
            onStartEdit={() => setEditingRefNumber(true)}
            onChangeDraft={setRefNumberDraft}
            onSave={handleSaveRefNumber}
            onCancel={() => {
              setRefNumberDraft(refNumberSaved ?? "");
              setEditingRefNumber(false);
            }}
          />

          {/* === 正規化ID編集セクション === */}
          <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80">
                  🔑 正規化ID (集計キー)
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  同じIDを持つレコードが中央値計算でグループ化されます
                </p>
              </div>
              {!editingNormalized && (
                <button
                  type="button"
                  onClick={() => setEditingNormalized(true)}
                  disabled={saving}
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50"
                >
                  ✎ 編集
                </button>
              )}
            </div>

            {!editingNormalized ? (
              <p className="font-mono text-sm text-amber-200">
                {normalizedSaved || <span className="text-zinc-600 italic">(未設定 - ref_numberかmodel_nameで集計)</span>}
              </p>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={normalizedDraft}
                  onChange={(e) => setNormalizedDraft(e.target.value)}
                  placeholder="例: DIESEL_MRDADDY"
                  className="
                    w-full px-3 py-2
                    bg-zinc-950/50 border border-zinc-800 rounded-md
                    text-amber-200 placeholder:text-zinc-600
                    text-sm font-mono
                    focus:outline-none focus:border-amber-500/60 focus:bg-zinc-900
                    transition-colors
                  "
                />
                <p className="text-[10px] text-zinc-500">
                  英数字とアンダースコアのみ。保存時に自動で大文字化・記号除去されます
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveNormalized}
                    disabled={saving}
                    className="px-3 py-1 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-md transition-colors disabled:opacity-50"
                  >
                    {saving ? "保存中..." : "保存"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNormalizedDraft(normalizedSaved ?? "");
                      setEditingNormalized(false);
                    }}
                    disabled={saving}
                    className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* === タグ編集セクション === */}
          <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-blue-300/80">
                  🏷️ タグ ({tagsSaved.length}個)
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  カラー・状態・付属品などの属性を表現
                </p>
              </div>
              {!editingTags && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTags(true);
                    setTagsDraft(new Set(tagsSaved));
                  }}
                  disabled={saving}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                >
                  ✎ 編集
                </button>
              )}
            </div>

            {!editingTags ? (
              // === 表示モード ===
              tagsSaved.length === 0 ? (
                <p className="text-[11px] text-zinc-600 italic">タグがありません</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tagsSaved.map(t => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 text-xs border border-blue-500/30"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )
            ) : (
              // === 編集モード ===
              <div className="space-y-3">
                {/* 現在のドラフト (クリックで削除) */}
                {tagsDraft.size > 0 && (
                  <div className="flex flex-wrap gap-1.5 pb-2 border-b border-zinc-800">
                    {[...tagsDraft].map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTagInDraft(t)}
                        className="
                          px-2 py-0.5 rounded-full
                          bg-blue-500 text-zinc-950 border border-blue-400 font-medium
                          text-xs hover:bg-rose-500 hover:border-rose-400
                          transition-colors
                        "
                        title="クリックで削除"
                      >
                        {t} ✕
                      </button>
                    ))}
                  </div>
                )}
                {tagsDraft.size === 0 && (
                  <p className="text-[11px] text-zinc-600 italic">タグなし。下から追加してください</p>
                )}

                {/* タグ追加方法切替ボタン */}
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowTagPicker(v => !v)}
                    className="
                      px-3 py-1 rounded-md
                      bg-zinc-800 hover:bg-zinc-700
                      text-zinc-300 border border-zinc-700
                      transition-colors
                    "
                  >
                    {showTagPicker ? "▲ 語彙を閉じる" : "▼ 語彙から選ぶ"}
                  </button>
                </div>

                {/* 語彙ピッカー */}
                {showTagPicker && (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1 bg-zinc-950/40 border border-zinc-800 rounded-md p-2">
                    {TAG_CATEGORIES.map(cat => (
                      <div key={cat.label}>
                        <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">
                          {cat.label}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {cat.tags.map(tag => {
                            const isActive = tagsDraft.has(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => toggleTagInDraft(tag)}
                                className={`
                                  px-2 py-0.5 rounded-full text-[10px]
                                  border transition-colors
                                  ${isActive
                                    ? "bg-blue-500 text-zinc-950 border-blue-400"
                                    : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-blue-500/15 hover:border-blue-500/40 hover:text-blue-300"
                                  }
                                `}
                              >
                                {isActive && "✓ "}{tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* カスタムタグ入力 */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomTag();
                      }
                    }}
                    placeholder="カスタムタグを追加 (例: ハルク、限定50本)"
                    className="
                      flex-1 px-3 py-1.5
                      bg-zinc-950/50 border border-zinc-800 rounded-md
                      text-zinc-200 placeholder:text-zinc-600
                      text-xs
                      focus:outline-none focus:border-blue-500/60
                      transition-colors
                    "
                  />
                  <button
                    type="button"
                    onClick={addCustomTag}
                    disabled={!customTagInput.trim()}
                    className="
                      px-3 py-1.5 text-xs
                      bg-zinc-800 hover:bg-zinc-700
                      text-zinc-300 border border-zinc-700
                      rounded-md transition-colors
                      disabled:opacity-30 disabled:cursor-not-allowed
                    "
                  >
                    + 追加
                  </button>
                </div>

                {/* 保存・キャンセル */}
                <div className="flex gap-2 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={handleSaveTags}
                    disabled={saving}
                    className="px-3 py-1 text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-zinc-950 rounded-md transition-colors disabled:opacity-50"
                  >
                    {saving ? "保存中..." : "保存"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelTagEdit}
                    disabled={saving}
                    className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 表示専用メタ */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {watch.surveyed_at && (<Field label="調査日" value={watch.surveyed_at} />)}
            {watch.listed_at && (<Field label="出品日" value={watch.listed_at} />)}
            {watch.sold_date && (<Field label="売却日" value={watch.sold_date} />)}
            {watch.days_to_sell != null && (<Field label="売却までの日数" value={`${watch.days_to_sell}日`} />)}
            {watch.sold_within_days != null && (<Field label="売却バッジ" value={`${watch.sold_within_days}日以内`} />)}
          </div>

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

          {error && (
            <div className="rounded-lg bg-rose-950/40 border border-rose-900 text-rose-200 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-zinc-800">
            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                disabled={deleting || saving}
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

// =============================
// 共通コンポーネント
// =============================
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-950/40 border border-zinc-800 rounded-md px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">{label}</p>
      <p className="text-sm text-zinc-200 font-mono truncate">{value}</p>
    </div>
  );
}

function EditableField({
  label,
  value,
  placeholder,
  emptyText = "(未設定)",
  isEditing,
  draft,
  saving,
  onStartEdit,
  onChangeDraft,
  onSave,
  onCancel
}: {
  label: string;
  value: string;
  placeholder: string;
  emptyText?: string;
  isEditing: boolean;
  draft: string;
  saving: boolean;
  onStartEdit: () => void;
  onChangeDraft: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg bg-zinc-950/40 border border-zinc-800 p-3 space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          {label}
        </p>
        {!isEditing && (
          <button
            type="button"
            onClick={onStartEdit}
            disabled={saving}
            className="text-xs text-zinc-500 hover:text-blue-300 transition-colors disabled:opacity-50"
          >
            ✎ 編集
          </button>
        )}
      </div>

      {!isEditing ? (
        <p className="text-sm text-zinc-200">
          {value || <span className="text-zinc-600 italic">{emptyText}</span>}
        </p>
      ) : (
        <div className="space-y-2 mt-1">
          <input
            type="text"
            value={draft}
            onChange={(e) => onChangeDraft(e.target.value)}
            placeholder={placeholder}
            className="
              w-full px-3 py-2
              bg-zinc-950/80 border border-zinc-700 rounded-md
              text-zinc-100 placeholder:text-zinc-600
              text-sm
              focus:outline-none focus:border-blue-500/60
              transition-colors
            "
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="px-3 py-1 text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-zinc-950 rounded-md transition-colors disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
