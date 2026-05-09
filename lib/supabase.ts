import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============================================
// Supabase クライアント
// ============================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
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
export type RecordType = "inventory" | "market";
export type PriceType  = "sold" | "buyback";

export type Watch = {
  id: string;
  record_type: RecordType;
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
  // 相場用 (record_type='market'時に意味を持つ)
  price_type: PriceType | null;
  source_url: string | null;
  surveyed_at: string | null;
  // 回転率データ (メルカリ等から取得、null許容)
  listed_at: string | null;
  days_to_sell: number | null;
  sold_within_days: number | null;
  // タグ (主に record_type='market' で使用)
  tags: string[];
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

// 相場集計の結果型 (market_medianビュー)
export type MarketMedian = {
  brand: string;
  ref_number: string | null;
  price_type: PriceType | null;
  channel: string | null;
  total_count: number;
  median_all: number;
  mean_all: number;
  median_filtered: number;
  filtered_count: number;
  min_price: number;
  max_price: number;
  last_surveyed_at: string | null;
};

// 相場検索フィルタ
export type MarketFilter = {
  query?: string;
  channel?: string;
  priceType?: PriceType | "";
  daysAgo?: number;  // 「過去N日」、0または未指定で全期間
  tags?: string[];   // 全タグを含むレコードのみ (AND条件)
};

// ============================================
// データ取得
// ============================================

// 仕入れデータのみ
export async function fetchInventoryWatches(): Promise<Watch[]> {
  const { data, error } = await supabase
    .from("watches")
    .select("*")
    .eq("record_type", "inventory")
    .order("stock_date", { ascending: false });

  if (error) {
    console.error("[supabase] fetchInventoryWatches error:", error);
    throw error;
  }
  return (data ?? []) as Watch[];
}

// 相場データの検索
export async function fetchMarketWatches(filter: MarketFilter = {}): Promise<Watch[]> {
  let q = supabase
    .from("watches")
    .select("*")
    .eq("record_type", "market");

  // チャネル絞り込み
  if (filter.channel) {
    q = q.eq("channel", filter.channel);
  }

  // 価格タイプ絞り込み
  if (filter.priceType) {
    q = q.eq("price_type", filter.priceType);
  }

  // 期間絞り込み
  if (filter.daysAgo && filter.daysAgo > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filter.daysAgo);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    q = q.gte("surveyed_at", cutoffStr);
  }

  // キーワード検索 (brand / model_name / ref_number に対するOR検索)
  if (filter.query && filter.query.trim() !== "") {
    const term = filter.query.trim();
    // PostgRESTのor構文 (※カンマでフィールドを区切る)
    // ilike は大文字小文字を無視する LIKE
    q = q.or(
      `brand.ilike.%${term}%,model_name.ilike.%${term}%,ref_number.ilike.%${term}%`
    );
  }

  // タグ絞り込み (全タグを含むレコードのみ = AND条件)
  // PostgreSQLの array contains 演算子: tags @> {緑文字盤,フルセット}
  if (filter.tags && filter.tags.length > 0) {
    q = q.contains("tags", filter.tags);
  }

  const { data, error } = await q.order("surveyed_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("[supabase] fetchMarketWatches error:", error);
    throw error;
  }
  return (data ?? []) as Watch[];
}

// 中央値ビューの取得
export async function fetchMarketMedian(): Promise<MarketMedian[]> {
  const { data, error } = await supabase
    .from("market_median")
    .select("*")
    .order("total_count", { ascending: false });

  if (error) {
    console.error("[supabase] fetchMarketMedian error:", error);
    throw error;
  }
  return (data ?? []) as MarketMedian[];
}

// ============================================
// 更新・削除
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

export async function deleteWatch(id: string): Promise<void> {
  const { error } = await supabase.from("watches").delete().eq("id", id);
  if (error) {
    console.error("[supabase] deleteWatch error:", error);
    throw error;
  }
}

// ============================================
// 利益計算 (仕入れ用)
// ============================================
const CHANNEL_FEE_RATE: Record<string, number> = {
  メルカリ: 0.10,
  ヤフオク: 0.088,
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

// ============================================
// 統計ユーティリティ (相場用)
// ============================================
export function calcStats(values: number[]) {
  if (values.length === 0) {
    return { count: 0, median: 0, mean: 0, min: 0, max: 0, medianFiltered: 0, filteredCount: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((s, v) => s + v, 0);

  // 中央値
  const median =
    count % 2 === 0
      ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
      : sorted[Math.floor(count / 2)];

  // 第1四分位数 (Q1)
  const q1Index = Math.floor(count * 0.25);
  const q1 = sorted[q1Index];

  // Q1未満を除外した中央値
  const filtered = sorted.filter(v => v >= q1);
  const fc = filtered.length;
  const medianFiltered =
    fc === 0 ? 0
    : fc % 2 === 0
      ? (filtered[fc / 2 - 1] + filtered[fc / 2]) / 2
      : filtered[Math.floor(fc / 2)];

  return {
    count,
    median,
    mean: sum / count,
    min: sorted[0],
    max: sorted[count - 1],
    medianFiltered,
    filteredCount: fc
  };
}

// チャネル一覧
export const CHANNELS = [
  "メルカリ",
  "ヤフオク",
  "楽天",
  "楽天ラクマ",
  "PayPayフリマ",
  "ebay",
  "セカンドストリート",
  "質屋_買取",
  "業者_買取",
  "店頭",
  "その他"
] as const;

// ============================================
// 目利きノート
// ============================================
export type Note = {
  id: string;
  title: string;
  category: string | null;
  body: string;
  tags: string[];
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type NoteUpsert = {
  id?: string;
  title: string;
  category: string | null;
  body: string;
  tags: string[];
  pinned: boolean;
};

export async function fetchNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[supabase] fetchNotes error:", error);
    throw error;
  }
  return (data ?? []) as Note[];
}

export async function createNote(note: NoteUpsert): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .insert({
      title: note.title,
      category: note.category,
      body: note.body,
      tags: note.tags,
      pinned: note.pinned
    })
    .select()
    .single();

  if (error) {
    console.error("[supabase] createNote error:", error);
    throw error;
  }
  return data as Note;
}

export async function updateNote(id: string, note: NoteUpsert): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .update({
      title: note.title,
      category: note.category,
      body: note.body,
      tags: note.tags,
      pinned: note.pinned
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[supabase] updateNote error:", error);
    throw error;
  }
  return data as Note;
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) {
    console.error("[supabase] deleteNote error:", error);
    throw error;
  }
}
