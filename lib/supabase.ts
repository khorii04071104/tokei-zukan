import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============================================
// Supabase クライアント
// ============================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL もしくは NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定です"
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  { auth: { persistSession: false } }
);

// ============================================
// 型定義
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
  stock_date: string;
  sold_date: string | null;
  rarity_rank: RarityRank | null;
  memo: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

// 編集モーダルから渡される更新可能フィールド
export type WatchUpdate = Partial<
  Pick<
    Watch,
    | "purchase_price"
    | "battery_cost"
    | "shipping_fee"
    | "sale_price"
    | "channel"
    | "sold_date"
    | "memo"
  >
>;

// ============================================
// 取得
// ============================================
export async function fetchWatches(): Promise<Watch[]> {
  const { data, error } = await supabase
    .from("watches")
    .select("*")
    .order("stock_date", { ascending: false });

  if (error) {
    console.error("[supabase] fetchWatches error:", error);
    throw error;
  }
  return (data ?? []) as Watch[];
}

// ============================================
// 更新
// ============================================
export async function updateWatch(id: string, patch: WatchUpdate): Promise<Watch> {
  const { data, error } = await supabase
    .from("watches")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[supabase] updateWatch error:", error);
    throw error;
  }
  return data as Watch;
}

// ============================================
// 削除
// ============================================
export async function deleteWatch(id: string): Promise<void> {
  const { error } = await supabase.from("watches").delete().eq("id", id);
  if (error) {
    console.error("[supabase] deleteWatch error:", error);
    throw error;
  }
}

// ============================================
// 利益計算
// ============================================

// チャネル別の手数料率
const CHANNEL_FEE_RATE: Record<string, number> = {
  メルカリ: 0.10,
  ヤフオク: 0.088,    // 8.8%
  楽天ラクマ: 0.10,
  PayPayフリマ: 0.05,
  ebay: 0.13,
  店頭: 0,
  その他: 0.10
};

export function getFeeRate(channel: string | null): number {
  if (!channel) return 0.10;
  return CHANNEL_FEE_RATE[channel] ?? 0.10;
}

export function calcProfit(w: Watch): number | null {
  if (w.sale_price == null) return null;
  const fee = Math.floor(w.sale_price * getFeeRate(w.channel));
  return w.sale_price - w.purchase_price - w.battery_cost - w.shipping_fee - fee;
}

export function calcProfitRate(w: Watch): number | null {
  if (w.sale_price == null) return null;
  const profit = calcProfit(w);
  if (profit == null) return null;
  return profit / w.sale_price;
}

// 利用可能なチャネル一覧 (UI用)
export const CHANNELS = [
  "メルカリ",
  "ヤフオク",
  "楽天ラクマ",
  "PayPayフリマ",
  "ebay",
  "店頭",
  "その他"
] as const;
