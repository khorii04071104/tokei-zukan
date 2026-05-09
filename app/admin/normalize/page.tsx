"use client";

import { useState } from "react";
import { supabase, Watch } from "@/lib/supabase";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent";

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";

// ============================================
// ブランド辞書 (popup.js と同期して保つこと)
// ============================================
const BRAND_RULES: Record<string, { strategy: string; note?: string }> = {
  "DIESEL":         { strategy: "series_name" },
  "PAUL SMITH":     { strategy: "series_name" },
  "ポールスミス":   { strategy: "series_name" },
  "COACH":          { strategy: "series_name" },
  "MARC JACOBS":    { strategy: "series_name" },
  "DKNY":           { strategy: "series_name" },
  "FOSSIL":         { strategy: "series_name" },
  "MICHAEL KORS":   { strategy: "series_name" },
  "ARMANI":         { strategy: "series_name" },
  "GUESS":          { strategy: "series_name" },
  "Vivienne Westwood": { strategy: "series_name" },
  "CASIO":          { strategy: "ref_base" },
  "G-SHOCK":        { strategy: "ref_base" },
  "BABY-G":         { strategy: "ref_base" },
  "ROLEX":          { strategy: "series_ref" },
  "OMEGA":          { strategy: "series_ref" },
  "TUDOR":          { strategy: "series_ref" },
  "GRAND SEIKO":    { strategy: "series_ref" },
  "IWC":            { strategy: "series_ref" },
  "BREITLING":      { strategy: "series_ref" },
  "CARTIER":        { strategy: "series_ref" },
  "PANERAI":        { strategy: "series_ref" },
  "TAG HEUER":      { strategy: "series_ref" },
  "HUBLOT":         { strategy: "series_ref" },
  "ZENITH":         { strategy: "series_ref" },
  "AUDEMARS PIGUET": { strategy: "series_ref" },
  "PATEK PHILIPPE": { strategy: "series_ref" },
  "SEIKO":          { strategy: "series_split" },
  "CITIZEN":        { strategy: "series_split" },
  "HAMILTON":       { strategy: "series_ref" },
  "LONGINES":       { strategy: "series_ref" },
  "ORIENT":         { strategy: "series_ref" },
  "EDOX":           { strategy: "series_ref" },
};

function buildBrandRulesText(): string {
  const STRATEGY_DESC: Record<string, string> = {
    "series_name":  "シリーズ名で集計 (型番は無視、シリーズ名を見つけて統一)",
    "ref_base":     "型番ベースで集計 (色記号は除外、限定識別子は残す)",
    "series_ref":   "シリーズ名+型番で集計 (色違いは別グループ、長い型番は最初の3桁)",
    "series_split": "シリーズ単位で別ブランド扱い (例: SEIKO_KINGQUARTZ)",
    "auto":         "一般的な判断"
  };
  const lines = ["【ブランド別の正規化ルール】"];
  for (const [brand, rule] of Object.entries(BRAND_RULES)) {
    const desc = STRATEGY_DESC[rule.strategy] || rule.strategy;
    lines.push(`- ${brand}: ${desc}`);
  }
  lines.push("- それ以外のブランド: 一般的な判断");
  return lines.join("\n");
}

function sanitizeNormalizedId(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

async function normalizeOne(
  brand: string,
  model_name: string,
  ref_number: string | null,
  retries = 3
): Promise<string | null> {
  const brandRulesText = buildBrandRulesText();

  const promptText = `あなたは時計の表記正規化システムです。
以下のブランドとモデル名から、正規化IDを生成してください。

${brandRulesText}

【共通ルール】
- 形式: BRAND_MODEL (アンダースコアで区切る)
- すべて英大文字、記号は除去
- カタカナはローマ字英訳に変換 ("ミスターダディ"→"MRDADDY")
- 同じモデルの色違い・サイズ違いは同じID (タグで区別する想定)
- 例外: 高級時計(ROLEX等)は型番違いを別グループにする

【パターン別の例】
- "DIESEL" + "Mr.Daddy DZ-7314" → "DIESEL_MRDADDY"
- "DIESEL" + "ミスターダディ" → "DIESEL_MRDADDY" (同じID)
- "DIESEL" + "DZ-7314" → "DIESEL_MRDADDY" (型番から逆引き)
- "CASIO" + "G-SHOCK GA-2100-1A1JF" → "GSHOCK_GA2100"
- "CASIO" + "G-SHOCK GA-2100SR-1A 限定" → "GSHOCK_GA2100SR" (SRは限定識別子で残す)
- "ROLEX" + "サブマリーナ 116610LV" → "ROLEX_SUBMARINER_116610LV"
- "ROLEX" + "サブマリーナ 116610LN" → "ROLEX_SUBMARINER_116610LN" (色違いは別)
- "OMEGA" + "Speedmaster 311.30.42.30.01.005" → "OMEGA_SPEEDMASTER_311"
- "GRAND SEIKO" + "SBGA001" → "GRANDSEIKO_SBGA001"
- "SEIKO" + "キングクォーツ 0832-7000" → "SEIKO_KINGQUARTZ"
- "SEIKO" + "グランドクォーツ" → "SEIKO_GRANDQUARTZ"

ブランド: ${brand}
モデル名: ${model_name}
型番: ${ref_number ?? "(なし)"}

回答は正規化IDの文字列のみ。説明や引用符は不要です。`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: promptText }] }]
      })
    });

    if (res.ok) {
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      const sanitized = sanitizeNormalizedId(text);
      return sanitized || null;
    }

    if (res.status === 429 && attempt < retries) {
      const retryAfterHeader = res.headers.get("Retry-After");
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
      const waitMs = retryAfter
        ? retryAfter * 1000
        : Math.min(4000 * Math.pow(2, attempt), 30000);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    throw new Error(`Gemini HTTP ${res.status}`);
  }

  return null;
}

export default function NormalizePage() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  function log(s: string) {
    setLogs(prev => [...prev, s]);
  }

  async function runBatch(onlyMissing: boolean = false) {
    if (!GEMINI_API_KEY) {
      alert(".env.local に NEXT_PUBLIC_GEMINI_API_KEY を設定してください");
      return;
    }

    const message = onlyMissing
      ? "正規化IDが未設定または空のレコードのみ処理します。よろしいですか？"
      : "既存の相場データすべての正規化IDをAIで再生成します。よろしいですか？\n\n注意: 既存の正規化IDも上書きされます。\n\n所要時間目安: 15件で1分、60件で4分";

    if (!confirm(message)) {
      return;
    }

    setRunning(true);
    setLogs([]);
    setErrors([]);

    try {
      const { data, error } = await supabase
        .from("watches")
        .select("id, brand, model_name, ref_number, model_name_normalized")
        .eq("record_type", "market");

      if (error) throw error;
      let watches = (data ?? []) as Pick<Watch, "id" | "brand" | "model_name" | "ref_number" | "model_name_normalized">[];

      if (onlyMissing) {
        watches = watches.filter(w => !w.model_name_normalized);
      }

      if (watches.length === 0) {
        log(`✅ 処理対象なし (${onlyMissing ? "未設定レコードがありません" : "データが0件"})`);
        return;
      }

      log(`📦 ${watches.length}件のレコードを処理開始 (4秒/件、推定 ${Math.ceil(watches.length * 4 / 60)} 分)`);
      setProgress({ done: 0, total: watches.length });

      let okCount = 0;
      let errCount = 0;

      for (let i = 0; i < watches.length; i++) {
        const w = watches[i];
        try {
          const normalized = await normalizeOne(w.brand, w.model_name, w.ref_number);
          if (normalized) {
            const { error: updateError } = await supabase
              .from("watches")
              .update({ model_name_normalized: normalized })
              .eq("id", w.id);
            if (updateError) throw updateError;
            log(`✓ [${i + 1}/${watches.length}] ${w.brand} / ${w.model_name} → ${normalized}`);
            okCount++;
          } else {
            log(`⚠ [${i + 1}/${watches.length}] ${w.brand} / ${w.model_name} → 空のID、スキップ`);
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          setErrors(prev => [...prev, `❌ ${w.brand} / ${w.model_name}: ${msg}`]);
          errCount++;
        }
        setProgress({ done: i + 1, total: watches.length });

        if (i < watches.length - 1) {
          await new Promise(r => setTimeout(r, 4000));
        }
      }

      log(`\n🎉 完了: 成功 ${okCount}件 / エラー ${errCount}件`);
      if (errCount > 0) {
        log(`💡 失敗した ${errCount} 件は「未設定のみ処理」で続行できます`);
      }
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
        <p className="text-sm text-zinc-400 mb-2">
          ブランド別ルールに従って、AIで正規化IDを再生成します。
        </p>
        <p className="text-xs text-amber-300/80 mb-6">
          📚 ルール辞書は <code className="text-amber-200">app/admin/normalize/page.tsx</code> と <code className="text-amber-200">popup.js</code> 内の BRAND_RULES に定義
        </p>

        <div className="bg-zinc-900/60 border border-amber-500/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-200 mb-2">⚠️ 注意</p>
          <ul className="text-xs text-zinc-400 space-y-1 list-disc list-inside">
            <li>処理中はタブを閉じないでください</li>
            <li>4秒/件のペースで処理 (Gemini無料枠の制限内)</li>
            <li>個別レコードの正規化IDは詳細モーダルから手動編集も可能です</li>
            <li>新ブランドが出てきたら BRAND_RULES に追加してから再実行</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => runBatch(false)}
            disabled={running}
            className="
              flex-1 px-6 py-3 text-sm font-semibold
              bg-gradient-to-r from-amber-500 to-amber-600
              hover:from-amber-400 hover:to-amber-500
              text-zinc-950 rounded-md
              transition-all
              disabled:opacity-50 disabled:cursor-wait
              shadow-[0_0_20px_-5px_rgba(212,165,116,0.5)]
            "
          >
            {running ? `処理中... (${progress.done}/${progress.total})` : "▶ 全件を再正規化"}
          </button>

          <button
            type="button"
            onClick={() => runBatch(true)}
            disabled={running}
            className="
              flex-1 px-6 py-3 text-sm font-semibold
              bg-zinc-900 hover:bg-zinc-800 border border-amber-500/40
              hover:border-amber-500/60
              text-amber-300 rounded-md
              transition-all
              disabled:opacity-50 disabled:cursor-wait
            "
          >
            {running ? `処理中...` : "↻ 未設定のみ処理 (推奨)"}
          </button>
        </div>

        <p className="mt-2 text-[11px] text-zinc-500">
          💡 一度失敗した件は「未設定のみ処理」で続きから再開できます
        </p>

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
