import { createServerClient } from './supabase-server';

export interface Transaction {
  id: string;
  created_at: string;
  amount: number;
  merchant: string;
  category: string;
  card_last4: string | null;
  include_in_insights: boolean;
  raw_text: string | null;
}

export interface MonthlyBudget {
  id: string;
  month: string;
  amount: number;
}

export interface CategoryRow {
  id: string;
  name: string;
  icon_key: string;
  color_key: string;
  created_at: string;
}

export interface MerchantSettingRow {
  merchant: string;
  category_name: string;
  image_url: string | null;
  updated_at: string;
}

function toMonthStartKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
}

function toMonthEndKey(year: number, monthIndex: number): string {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

async function getBudgetRowByExactMonth(monthKey: string): Promise<MonthlyBudget | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('monthly_budgets')
    .select('*')
    .eq('month', monthKey)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching budget by exact month:', error);
    return null;
  }

  return data as MonthlyBudget;
}

async function getLegacyBudgetRowWithinMonth(year: number, monthIndex: number): Promise<MonthlyBudget | null> {
  const supabase = createServerClient();
  const monthStartKey = toMonthStartKey(year, monthIndex);
  const monthEndKey = toMonthEndKey(year, monthIndex);

  const { data, error } = await supabase
    .from('monthly_budgets')
    .select('*')
    .gte('month', monthStartKey)
    .lte('month', monthEndKey)
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching legacy month budget row:', error);
    return null;
  }

  return (data as MonthlyBudget | null) ?? null;
}

async function createBudgetFromLatestPreviousMonth(monthKey: string): Promise<MonthlyBudget | null> {
  const supabase = createServerClient();

  const { data: previous, error: previousError } = await supabase
    .from('monthly_budgets')
    .select('amount')
    .lt('month', monthKey)
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previousError) {
    console.error('Error fetching previous month budget:', previousError);
    return null;
  }

  if (!previous?.amount) return null;

  const { data: inserted, error: insertError } = await supabase
    .from('monthly_budgets')
    .upsert(
      {
        month: monthKey,
        amount: previous.amount,
      },
      {
        onConflict: 'month',
      }
    )
    .select('*')
    .single();

  if (insertError) {
    console.error('Error creating carried-over budget:', insertError);
    return null;
  }

  return inserted as MonthlyBudget;
}

function toLocalWallTimeIso(value: string): string {
  // Keep date/time as entered (wall-clock) and strip timezone suffix to avoid UI shifts.
  // Example: "2026-01-25T22:24:00+02:00" -> "2026-01-25T22:24:00"
  // Example: "2026-01-25 22:24:00+00"    -> "2026-01-25T22:24:00"
  return value
    .replace(' ', 'T')
    .replace(/(?:Z|[+\-]\d{2}:?\d{2})$/i, '');
}

/**
 * Fetch all transactions from Supabase
 */
export async function getTransactions(): Promise<Transaction[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }

  return (data || []).map((t: any) => ({
    ...t,
    created_at: typeof t.created_at === 'string' ? toLocalWallTimeIso(t.created_at) : t.created_at,
  }));
}

/**
 * Fetch configured categories (Settings)
 */
export async function getCategories(): Promise<CategoryRow[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  return (data as any) || [];
}

/**
 * Fetch merchant settings (merchant -> category mapping + image)
 */
export async function getMerchantSettings(): Promise<MerchantSettingRow[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('merchant_settings')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching merchant settings:', error);
    return [];
  }

  return (data as any) || [];
}

/**
 * Get unique merchants seen in transactions (most recent first)
 */
export async function getUniqueMerchants(): Promise<string[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('transactions')
    .select('merchant, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching merchants:', error);
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const row of data || []) {
    const m = (row as any)?.merchant;
    if (m && !seen.has(m)) {
      seen.add(m);
      result.push(m);
    }
  }
  return result;
}

/**
 * Best-effort fallback category for each merchant (most recent transaction wins).
 */
export async function getMerchantDefaultCategories(): Promise<Record<string, string>> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('transactions')
    .select('merchant, category, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching merchant default categories:', error);
    return {};
  }

  const map: Record<string, string> = {};
  for (const row of data || []) {
    const merchant = (row as any)?.merchant as string | undefined;
    const category = (row as any)?.category as string | undefined;
    if (!merchant || !category) continue;
    if (!map[merchant]) {
      map[merchant] = category;
    }
  }
  return map;
}

/**
 * Get current month's budget
 */
export async function getCurrentMonthBudget(): Promise<MonthlyBudget | null> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthString = toMonthStartKey(year, month);
  const isFirstDayOfMonth = now.getDate() === 1;

  const exact = await getBudgetRowByExactMonth(monthString);
  if (exact) return exact;

  const legacyRow = await getLegacyBudgetRowWithinMonth(year, month);
  if (legacyRow) return legacyRow;

  // Auto-create the current month budget from the previous month.
  // Requirement: this should happen when a new month starts.
  if (isFirstDayOfMonth) {
    return await createBudgetFromLatestPreviousMonth(monthString);
  }

  return null;
}

/**
 * Calculate total spent for current month (only include_in_insights = true)
 */
export async function getCurrentMonthSpent(): Promise<number> {
  const supabase = createServerClient();
  
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('include_in_insights', true)
    .gte('created_at', firstDayOfMonth.toISOString())
    .lte('created_at', lastDayOfMonth.toISOString());

  if (error) {
    console.error('Error calculating spent:', error);
    return 0;
  }

  return data?.reduce((sum, transaction) => sum + Number(transaction.amount), 0) || 0;
}

/**
 * Get unique card numbers from transactions
 */
export async function getUniqueCardNumbers(): Promise<string[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('transactions')
    .select('card_last4')
    .not('card_last4', 'is', null);

  if (error) {
    console.error('Error fetching card numbers:', error);
    return [];
  }

  const uniqueCards = [...new Set(data?.map(t => t.card_last4).filter(Boolean))];
  return uniqueCards as string[];
}

export interface DailySpending {
  date: string;
  total: number;
}

export interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
}

/**
 * Get daily spending for a specific month
 */
export async function getDailySpending(
  year: number,
  month: number,
  cardNumbers?: string[]
): Promise<DailySpending[]> {
  const supabase = createServerClient();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

  let query = supabase
    .from('transactions')
    .select('created_at, amount')
    .eq('include_in_insights', true)
    .gte('created_at', firstDayOfMonth.toISOString())
    .lte('created_at', lastDayOfMonth.toISOString());

  if (cardNumbers && cardNumbers.length > 0) {
    query = query.in('card_last4', cardNumbers);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching daily spending:', error);
    return [];
  }

  // Group by date
  const dailyMap = new Map<string, number>();
  
  data?.forEach(transaction => {
    const date = new Date(transaction.created_at).toISOString().split('T')[0];
    const current = dailyMap.get(date) || 0;
    dailyMap.set(date, current + Number(transaction.amount));
  });

  // Convert to array and calculate cumulative totals
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const result: DailySpending[] = [];
  let cumulative = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateString = date.toISOString().split('T')[0];
    const dayTotal = dailyMap.get(dateString) || 0;
    cumulative += dayTotal;
    result.push({
      date: dateString,
      total: cumulative,
    });
  }

  return result;
}

/**
 * Get category spending breakdown for a specific month
 */
export async function getCategorySpending(
  year: number,
  month: number,
  cardNumbers?: string[]
): Promise<CategorySpending[]> {
  const supabase = createServerClient();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

  let query = supabase
    .from('transactions')
    .select('category, amount')
    .eq('include_in_insights', true)
    .gte('created_at', firstDayOfMonth.toISOString())
    .lte('created_at', lastDayOfMonth.toISOString());

  if (cardNumbers && cardNumbers.length > 0) {
    query = query.in('card_last4', cardNumbers);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching category spending:', error);
    return [];
  }

  // Group by category
  const categoryMap = new Map<string, number>();
  
  data?.forEach(transaction => {
    const current = categoryMap.get(transaction.category) || 0;
    categoryMap.set(transaction.category, current + Number(transaction.amount));
  });

  const total = Array.from(categoryMap.values()).reduce((sum, amount) => sum + amount, 0);

  // Convert to array with percentages
  const result: CategorySpending[] = Array.from(categoryMap.entries()).map(([category, amount]) => ({
    category,
    amount,
    percentage: total > 0 ? (amount / total) * 100 : 0,
  }));

  return result.sort((a, b) => b.amount - a.amount);
}

/**
 * Get budget for a specific month
 */
export async function getMonthBudget(year: number, month: number): Promise<MonthlyBudget | null> {
  const monthString = toMonthStartKey(year, month);
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
  const isFirstDayOfMonth = now.getDate() === 1;

  const exact = await getBudgetRowByExactMonth(monthString);
  if (exact) return exact;

  const legacyRow = await getLegacyBudgetRowWithinMonth(year, month);
  if (legacyRow) return legacyRow;

  // Same auto-create behavior when user opens Budget tab on month start.
  if (isCurrentMonth && isFirstDayOfMonth) {
    return await createBudgetFromLatestPreviousMonth(monthString);
  }

  return null;
}

/**
 * Get total spent for a specific month
 */
export async function getMonthSpent(
  year: number,
  month: number,
  cardNumbers?: string[]
): Promise<number> {
  const supabase = createServerClient();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

  let query = supabase
    .from('transactions')
    .select('amount')
    .eq('include_in_insights', true)
    .gte('created_at', firstDayOfMonth.toISOString())
    .lte('created_at', lastDayOfMonth.toISOString());

  if (cardNumbers && cardNumbers.length > 0) {
    query = query.in('card_last4', cardNumbers);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error calculating spent:', error);
    return 0;
  }

  return data?.reduce((sum, transaction) => sum + Number(transaction.amount), 0) || 0;
}
