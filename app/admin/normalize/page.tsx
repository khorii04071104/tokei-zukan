"use client";

import { useState } from "react";
import { supabase, Watch } from "@/lib/supabase";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

// 環境変数から取得 (.env.localに NEXT_PUBLIC_GEMINI_API_KEY を追加してください)
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";

function sanitizeNormalizedId(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

async function normalizeOne(brand: string, model_name: string): Promise<string | null> {
  const promptText = `あなたは時計の表記正規化システムです。
以下のブランドとモデル名から、正規化IDを生成してください。

ルール:
1. 「BRAND_MODEL」形式
2. すべて英大文字
3. スペース、ピリオド、ハイフン、記号は全て削除
4. カタカナの場合は対応する英語に変換 (例: "ミスターダディ" → "MRDADDY")
5. 同じモデルの別カラー/サイズ/限定版は同じIDにする

例:
- "DIESEL" + "Mr.Daddy DZ7314" → "DIESEL_MRDADDY"
- "ディーゼル" + "ミスターダディ" → "DIESEL_MRDADDY"
- "ROLEX" + "サブマリーナ 116610LV" → "ROLEX_SUBMARINER"
- "GRAND SEIKO" + "SBGA001" → "GRANDSEIKO_SBGA001"

ブランド: ${brand}
モデル名: ${model_name}

回答は正規化IDの文字列のみ。説明や引用符は不要です。`;

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: promptText }] }]
    })
  });

  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  const sanitized = sanitizeNormalizedId(text);
  return sanitized || null;
}

export default function NormalizePage() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  function log(s: string) {
    setLogs(prev => [...prev, s]);
  }

  async function runBatch() {
    if (!GEMINI_API_KEY) {
      alert(".env.local に NEXT_PUBLIC_GEMINI_API_KEY を設定してください");
      return;
    }

    if (!confirm("既存の相場データすべての正規化IDをAIで再生成します。よろしいですか？\n\n注意: 既存の正規化IDは上書きされます。")) {
      return;
    }

    setRunning(true);
    setLogs([]);
    setErrors([]);

    try {
      // 全相場データを取得
      const { data, error } = await supabase
        .from("watches")
        .select("id, brand, model_name, model_name_normalized")
        .eq("record_type", "market");

      if (error) throw error;
      const watches = (data ?? []) as Pick<Watch, "id" | "brand" | "model_name" | "model_name_normalized">[];

      log(`📦 ${watches.length}件のレコードを処理開始`);
      setProgress({ done: 0, total: watches.length });

      let okCount = 0;
      let errCount = 0;

      for (let i = 0; i < watches.length; i++) {
        const w = watches[i];
        try {
          const normalized = await normalizeOne(w.brand, w.model_name);
          if (normalized) {
            const { error: updateError } = await supabase
              .from("watches")
              .update({ model_name_normalized: normalized })
              .eq("id", w.id);
            if (updateError) throw updateError;
            log(`✓ ${w.brand} / ${w.model_name} → ${normalized}`);
            okCount++;
          } else {
            log(`⚠ ${w.brand} / ${w.model_name} → 空のID、スキップ`);
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          setErrors(prev => [...prev, `❌ ${w.brand} / ${w.model_name}: ${msg}`]);
          errCount++;
        }
        setProgress({ done: i + 1, total: watches.length });

        // レート制限対策: 100msスリープ (15RPM = 4秒/件 だが、burstを許容)
        await new Promise(r => setTimeout(r, 200));
      }

      log(`\n🎉 完了: 成功 ${okCount}件 / エラー ${errCount}件`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrors(prev => [...prev, `致命的エラー: ${msg}`]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-zinc-200 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-serif text-3xl text-amber-50 mb-2">🛠️ 既存データの正規化</h1>
        <p className="text-sm text-zinc-400 mb-8">
          既存の相場データすべてに対して AI で正規化IDを再生成します。
          この処理は冪等です（何度実行しても結果は同じ）。
        </p>

        <div className="bg-zinc-900/60 border border-amber-500/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-200 mb-2">⚠️ 注意</p>
          <ul className="text-xs text-zinc-400 space-y-1 list-disc list-inside">
            <li>処理中はタブを閉じないでください</li>
            <li>既存の正規化IDは上書きされます</li>
            <li>Geminiのレート制限 (15RPM) のため、件数が多いと時間がかかります</li>
            <li>個別レコードの正規化IDは詳細モーダルから手動編集も可能です</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={runBatch}
          disabled={running}
          className="
            px-6 py-3 text-sm font-semibold
            bg-gradient-to-r from-amber-500 to-amber-600
            hover:from-amber-400 hover:to-amber-500
            text-zinc-950 rounded-md
            transition-all
            disabled:opacity-50 disabled:cursor-wait
            shadow-[0_0_20px_-5px_rgba(212,165,116,0.5)]
          "
        >
          {running ? `処理中... (${progress.done}/${progress.total})` : "▶ 一括正規化を開始"}
        </button>

        {progress.total > 0 && (
          <div className="mt-6">
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>進捗</span>
              <span>{progress.done} / {progress.total}</span>
            </div>
            <div className="h-2 bg-zinc-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="mt-6 bg-rose-950/30 border border-rose-900 rounded-lg p-3">
            <p className="text-xs text-rose-300 mb-2">エラー ({errors.length}件)</p>
            <pre className="text-[10px] text-rose-200 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
              {errors.join("\n")}
            </pre>
          </div>
        )}

        {logs.length > 0 && (
          <div className="mt-6 bg-zinc-900/40 border border-zinc-800 rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-2">ログ</p>
            <pre className="text-[10px] text-zinc-300 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
              {logs.join("\n")}
            </pre>
          </div>
        )}

        <p className="mt-12 text-xs text-zinc-600">
          このページは管理用です。完了したら不要なら <code className="text-zinc-500">app/admin/</code> フォルダを削除してください。
        </p>
      </div>
    </main>
  );
}
