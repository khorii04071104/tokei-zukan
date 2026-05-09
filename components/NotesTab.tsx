"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchNotes, createNote, updateNote, deleteNote, Note, NoteUpsert } from "@/lib/supabase";
import NoteEditModal from "@/components/NoteEditModal";

// シンプルなMarkdownレンダラ (見出し、太字、リスト、表のみ対応)
function renderMarkdown(text: string): string {
  const lines = text.split("\n");
  const html: string[] = [];
  let inList = false;
  let inTable = false;
  let tableHeader: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 表の処理 (| col1 | col2 |)
    if (/^\s*\|.+\|\s*$/.test(line)) {
      const cells = line.split("|").slice(1, -1).map(c => c.trim());

      // 区切り行 (|---|---|) はスキップ
      if (cells.every(c => /^[-:\s]+$/.test(c))) continue;

      if (!inTable) {
        if (inList) { html.push("</ul>"); inList = false; }
        html.push('<table class="my-3 border-collapse text-xs">');
        tableHeader = cells;
        html.push("<thead><tr>");
        for (const c of cells) {
          html.push(`<th class="border border-emerald-900/40 px-3 py-1.5 bg-emerald-950/30 text-emerald-300 font-medium text-left">${escapeHtml(c)}</th>`);
        }
        html.push("</tr></thead><tbody>");
        inTable = true;
      } else {
        html.push("<tr>");
        for (const c of cells) {
          html.push(`<td class="border border-zinc-800 px-3 py-1.5 text-zinc-300">${inlineFormat(c)}</td>`);
        }
        html.push("</tr>");
      }
      continue;
    } else if (inTable) {
      html.push("</tbody></table>");
      inTable = false;
    }

    // 見出し
    if (/^### /.test(line)) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h3 class="text-sm font-bold text-emerald-300 mt-4 mb-2">${inlineFormat(line.slice(4))}</h3>`);
    } else if (/^## /.test(line)) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h2 class="text-base font-bold text-emerald-200 mt-5 mb-2">${inlineFormat(line.slice(3))}</h2>`);
    } else if (/^# /.test(line)) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h1 class="text-lg font-bold text-emerald-100 mt-5 mb-3">${inlineFormat(line.slice(2))}</h1>`);
    }
    // リスト
    else if (/^[\s]*[-*]\s+/.test(line)) {
      if (!inList) {
        html.push('<ul class="list-disc list-inside space-y-1 my-2 text-sm">');
        inList = true;
      }
      html.push(`<li class="text-zinc-300">${inlineFormat(line.replace(/^[\s]*[-*]\s+/, ""))}</li>`);
    }
    // 番号付きリスト
    else if (/^\d+\.\s+/.test(line)) {
      if (!inList) {
        html.push('<ol class="list-decimal list-inside space-y-1 my-2 text-sm">');
        inList = true;
      }
      html.push(`<li class="text-zinc-300">${inlineFormat(line.replace(/^\d+\.\s+/, ""))}</li>`);
    }
    // 空行
    else if (line.trim() === "") {
      if (inList) { html.push("</ul>"); inList = false; }
    }
    // 通常段落
    else {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<p class="text-sm text-zinc-300 leading-relaxed my-2">${inlineFormat(line)}</p>`);
    }
  }

  if (inList) html.push("</ul>");
  if (inTable) html.push("</tbody></table>");

  return html.join("");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineFormat(s: string): string {
  // **bold** → <strong>
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-emerald-200">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-zinc-800 text-emerald-300 text-xs font-mono">$1</code>');
}

// =============================
// メイン
// =============================
export default function NotesTab() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<Note | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await fetchNotes();
        setNotes(data);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // カテゴリ一覧 (notes に存在するもののみ)
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) {
      if (n.category) set.add(n.category);
    }
    return [...set].sort();
  }, [notes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter(n => {
      if (filterCategory && n.category !== filterCategory) return false;
      if (!q) return true;
      const hay = [n.title, n.body, n.category ?? "", ...(n.tags ?? [])].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [notes, query, filterCategory]);

  const pinned = filtered.filter(n => n.pinned);
  const others = filtered.filter(n => !n.pinned);

  async function handleSave(input: NoteUpsert, id: string | null) {
    try {
      if (id) {
        const updated = await updateNote(id, input);
        setNotes(prev => prev.map(n => n.id === id ? updated : n));
      } else {
        const created = await createNote(input);
        setNotes(prev => [created, ...prev]);
      }
      setEditingNote(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`保存失敗: ${msg}`);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteNote(id);
      setNotes(prev => prev.filter(n => n.id !== id));
      setEditingNote(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`削除失敗: ${msg}`);
    }
  }

  return (
    <>
      <p className="text-xs text-zinc-500 mb-6 font-mono leading-relaxed">
        📖 目利きノートは、仕入れ判断や鑑定の知見を蓄える場所です。
        ノートに付けたタグは、相場タブのタグと連動します。
      </p>

      {/* 検索 + 新規作成 */}
      <section className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="タイトル・本文・タグで検索..."
            className="
              w-full px-4 py-3 pr-10
              bg-zinc-900/60 border border-zinc-800 rounded-lg
              text-zinc-100 placeholder:text-zinc-600
              focus:outline-none focus:border-emerald-500/50 focus:bg-zinc-900
              transition-colors
            "
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">⌕</span>
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-3 bg-zinc-900/60 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-emerald-500/50"
        >
          <option value="">すべてのカテゴリ</option>
          {categories.map(c => (<option key={c} value={c}>{c}</option>))}
        </select>

        <button
          type="button"
          onClick={() => setEditingNote("new")}
          className="
            px-5 py-3 text-sm font-semibold whitespace-nowrap
            bg-gradient-to-r from-emerald-500 to-emerald-600
            hover:from-emerald-400 hover:to-emerald-500
            text-zinc-950 rounded-lg
            shadow-[0_0_20px_-5px_rgba(16,185,129,0.5)]
          "
        >
          + 新規ノート
        </button>
      </section>

      <p className="text-xs text-zinc-500 mb-4 font-mono">
        {loading ? "読み込み中..." : `${filtered.length} 件のノート`}
      </p>

      {error && (
        <div className="rounded-lg bg-rose-950/40 border border-rose-900 text-rose-200 px-5 py-4">
          <p className="text-sm font-bold mb-1">エラー</p>
          <p className="text-xs font-mono">{error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-20 text-zinc-500">
          <p className="font-serif text-2xl mb-2 text-zinc-400">📖</p>
          <p>ノートがまだありません</p>
          <p className="text-xs mt-2 text-zinc-600">「+ 新規ノート」から知見を残しましょう</p>
        </div>
      )}

      {/* ピン留めセクション */}
      {pinned.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[10px] uppercase tracking-[0.25em] text-emerald-500/80 mb-3 flex items-center gap-2">
            <span>📌 重要ノート</span>
            <span className="flex-1 h-px bg-gradient-to-r from-emerald-500/30 to-transparent" />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pinned.map(n => (
              <NoteCard key={n.id} note={n} onClick={() => setEditingNote(n)} />
            ))}
          </div>
        </section>
      )}

      {/* 通常セクション */}
      {others.length > 0 && (
        <section>
          {pinned.length > 0 && (
            <h2 className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-3 flex items-center gap-2">
              <span>📝 すべてのノート</span>
              <span className="flex-1 h-px bg-gradient-to-r from-zinc-700 to-transparent" />
            </h2>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {others.map(n => (
              <NoteCard key={n.id} note={n} onClick={() => setEditingNote(n)} />
            ))}
          </div>
        </section>
      )}

      {/* 編集モーダル */}
      {editingNote && (
        <NoteEditModal
          note={editingNote === "new" ? null : editingNote}
          onClose={() => setEditingNote(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}

// =============================
// ノートカード
// =============================
function NoteCard({ note, onClick }: { note: Note; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        relative overflow-hidden rounded-xl text-left w-full
        bg-gradient-to-br from-zinc-900 to-black
        border border-zinc-800
        hover:border-emerald-500/40 hover:shadow-[0_0_30px_-10px_rgba(16,185,129,0.4)]
        active:scale-[0.99]
        transition-all
        cursor-pointer
        p-5
      "
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          {note.category && (
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-500/70 mb-1">
              {note.category}
            </p>
          )}
          <h3 className="font-serif text-lg text-emerald-50 leading-snug">
            {note.title}
          </h3>
        </div>
        {note.pinned && (
          <span className="shrink-0 text-amber-400 text-sm" title="ピン留め">📌</span>
        )}
      </div>

      {/* 本文プレビュー (最初の数行) */}
      <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed mb-3">
        {note.body.replace(/[#*`]/g, "").slice(0, 200)}
      </p>

      {/* タグ */}
      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {note.tags.slice(0, 6).map(t => (
            <span
              key={t}
              className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 text-[10px] border border-emerald-500/20"
            >
              {t}
            </span>
          ))}
          {note.tags.length > 6 && (
            <span className="text-[10px] text-zinc-500 self-center">+{note.tags.length - 6}</span>
          )}
        </div>
      )}

      <p className="text-[9px] text-zinc-600 font-mono mt-3 pt-3 border-t border-zinc-800/60">
        Updated {note.updated_at.slice(0, 10)}
      </p>
    </button>
  );
}

// 親に export しておく (NoteEditModal が renderMarkdown を使う)
export { renderMarkdown };
