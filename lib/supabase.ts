import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============================================
// Supabase クライアント
// 環境変数から接続情報を読み込む
// ============================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  // ビルド時/起動時に気付けるようにエラーを出す
  // (本番でも env が無いと動かないので明示的に落とす)
  // eslint-disable-next-line no-console
  console.error(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL もしくは NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定です"
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: { persistSession: false }
  }
);

// ============================================
// 型定義 - watches テーブルの行
// ============================================
export type RarityRank = "SS" | "A" | "B" | "C";

export type Watch = {
  id: string;
  brand: string;
  model_name: string;
  ref_number: string | null;
  purchase_price: number;
  battery_cost: number;
  cleaning_time: number | null;
  shipping_fee: number;
  sale_price: number | null;
  channel: string | null;
  stock_date: string;        // YYYY-MM-DD
  sold_date: string | null;
  rarity_rank: RarityRank | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================
// データ取得
// ============================================
export async function fetchWatches(): Promise<Watch[]> {
  const { data, error } = await supabase
    .from("watches")
    .select("*")
    .order("stock_date", { ascending: false });

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[supabase] fetchWatches error:", error);
    throw error;
  }
  return (data ?? []) as Watch[];
}

// ============================================
// ユーティリティ - 利益計算
// 利益 = 販売価格 - 仕入価格 - 電池代 - 送料 - 決済手数料(10%目安)
// ============================================
export function calcProfit(w: Watch): number | null {
  if (w.sale_price == null) return null;
  const fee = Math.floor(w.sale_price * 0.1); // 10%手数料 (メルカリ想定)
  return w.sale_price - w.purchase_price - w.battery_cost - w.shipping_fee - fee;
}

export function calcProfitRate(w: Watch): number | null {
  if (w.sale_price == null) return null;
  const profit = calcProfit(w);
  if (profit == null) return null;
  return profit / w.sale_price;
}
