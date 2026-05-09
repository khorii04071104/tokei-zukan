"use client";

import { useEffect, useState } from "react";
import { Note, NoteUpsert } from "@/lib/supabase";
import { renderMarkdown } from "@/components/NotesTab";

const CATEGORIES = [
  "サイズ知識",
  "ヴィンテージ判別",
  "状態・付属品",
  "高値デザイン",
  "文字盤色",
  "限定モデル",
  "ブランド別",
  "真贋ポイント",
  "その他"
];

type Props = {
  note: Note | null;  // null = 新規作成
  onClose: () => void;
  onSave: (input: NoteUpsert, id: string | null) => void;
  onDelete: (id: string) => void;
};

export default function NoteEditModal({ note, onClose, onSave, onDelete }: Props) {
  const [title,    setTitle]    = useState(note?.title ?? "");
  const [category, setCategory] = useState(note?.category ?? "");
  const [body,     setBody]     = useState(note?.body ?? "");
  const [tagsText, setTagsText] = useState((note?.tags ?? []).join(", "));
  const [pinned,   setPinned]   = useState(note?.pinned ?? false);
  const [previewMode, setPreviewMode] = useState(false);
  const [confirmingDelete, setConfirming] = useState(false);

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

  function handleSubmit() {
    if (!title.trim()) {
      alert("タイトルを入力してください");
      return;
    }
    if (!body.trim()) {
      alert("本文を入力してください");
      return;
    }
    const tags = tagsText
      .split(",")
      .map(t => t.trim())
      .filter(t => t.length > 0);

    onSave(
      {
        title: title.trim(),
        category: category || null,
        body: body.trim(),
        tags,
        pinned
      },
      note?.id ?? null
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="
        relative w-full max-w-3xl max-h-[90vh] overflow-y-auto
        bg-gradient-to-br from-zinc-900 via-zinc-900 to-black
        border border-zinc-800 rounded-xl
        shadow-[0_0_60px_-10px_rgba(16,185,129,0.3)]
      ">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />

        {/* ヘッダー */}
        <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-500/70 mb-1">
              {note ? "Edit Note" : "New Note"}
            </p>
            <h2 className="font-serif text-2xl text-emerald-50 truncate">
              {title || "(無題)"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="ml-4 shrink-0 w-9 h-9 rounded-full text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800/60 transition-colors text-xl"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* タイトル */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5">
              タイトル
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: ヴィンテージ時計の見極めポイント"
              className="
                w-full px-3 py-2
                bg-zinc-950/50 border border-zinc-800 rounded-md
                text-zinc-100 placeholder:text-zinc-600
                text-base
                focus:outline-none focus:border-emerald-500/60 focus:bg-zinc-900
                transition-colors
              "
            />
          </div>

          {/* カテゴリ + ピン留め */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5">
                カテゴリ
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="
                  w-full px-3 py-2
                  bg-zinc-950/50 border border-zinc-800 rounded-md
                  text-zinc-200 text-sm
                  focus:outline-none focus:border-emerald-500/60
                "
              >
                <option value="">-- カテゴリなし --</option>
                {CATEGORIES.map(c => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="accent-amber-400"
                />
                <span className="text-sm text-zinc-300">📌 ピン留め</span>
              </label>
            </div>
          </div>

          {/* タグ */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5">
              タグ (カンマ区切り)
            </label>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="例: 緑文字盤, ヴィンテージ, 17cm"
              className="
                w-full px-3 py-2
                bg-zinc-950/50 border border-zinc-800 rounded-md
                text-zinc-100 placeholder:text-zinc-600
                text-sm font-mono
                focus:outline-none focus:border-emerald-500/60 focus:bg-zinc-900
                transition-colors
              "
            />
            <p className="text-[10px] text-zinc-600 mt-1">
              相場タブのタグと連動します
            </p>
          </div>

          {/* 本文 (タブ切替: 編集 / プレビュー) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                本文 (Markdown対応)
              </label>
              <div className="flex gap-1 bg-zinc-900/60 border border-zinc-800 rounded-md p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setPreviewMode(false)}
                  className={`px-3 py-1 rounded transition-colors ${
                    !previewMode ? "bg-emerald-500/15 text-emerald-300" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  ✎ 編集
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode(true)}
                  className={`px-3 py-1 rounded transition-colors ${
                    previewMode ? "bg-emerald-500/15 text-emerald-300" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  👁 プレビュー
                </button>
              </div>
            </div>

            {previewMode ? (
              <div className="
                w-full min-h-[280px]
                px-4 py-3
                bg-zinc-950/50 border border-zinc-800 rounded-md
                overflow-auto
              ">
                {body.trim() ? (
                  <div dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
                ) : (
                  <p className="text-sm text-zinc-600 italic">本文を入力するとここにプレビューが表示されます</p>
                )}
              </div>
            ) : (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                placeholder={`### 見出し\n\n本文...\n\n- リスト1\n- リスト2\n\n**太字** や \`コード\` も使えます`}
                className="
                  w-full px-3 py-2
                  bg-zinc-950/50 border border-zinc-800 rounded-md
                  text-zinc-100 placeholder:text-zinc-600
                  text-sm font-mono leading-relaxed
                  focus:outline-none focus:border-emerald-500/60 focus:bg-zinc-900
                  transition-colors
                  resize-y
                "
              />
            )}
            <p className="text-[10px] text-zinc-600 mt-1">
              対応書式: # 見出し / **太字** / - リスト / 1. 番号付き / `コード` / 表 (| 列1 | 列2 |)
            </p>
          </div>

          {/* ボタン */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-zinc-800">
            {note && !confirmingDelete && (
              <button
                onClick={() => setConfirming(true)}
                className="text-xs text-zinc-600 hover:text-rose-400 transition-colors self-start sm:self-auto"
              >
                このノートを削除...
              </button>
            )}
            {note && confirmingDelete && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-300">本当に削除しますか?</span>
                <button
                  onClick={() => onDelete(note.id)}
                  className="px-3 py-1 text-xs bg-rose-600 hover:bg-rose-500 text-white rounded-md transition-colors"
                >
                  削除する
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  やめる
                </button>
              </div>
            )}
            {!note && <div />}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-5 py-2 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-md transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                className="
                  px-6 py-2 text-sm font-semibold
                  bg-gradient-to-r from-emerald-500 to-emerald-600
                  hover:from-emerald-400 hover:to-emerald-500
                  text-zinc-950 rounded-md
                  transition-all
                  shadow-[0_0_20px_-5px_rgba(16,185,129,0.5)]
                "
              >
                {note ? "保存" : "作成"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
