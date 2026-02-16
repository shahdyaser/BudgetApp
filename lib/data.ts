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

  return data || [];
}

/**
 * Get current month's budget
 */
export async function getCurrentMonthBudget(): Promise<MonthlyBudget | null> {
  const supabase = createServerClient();
  
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const monthString = firstDayOfMonth.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('monthly_budgets')
    .select('*')
    .eq('month', monthString)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No budget found for this month
      return null;
    }
    console.error('Error fetching budget:', error);
    return null;
  }

  return data;
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
  const supabase = createServerClient();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const monthString = firstDayOfMonth.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('monthly_budgets')
    .select('*')
    .eq('month', monthString)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching budget:', error);
    return null;
  }

  return data;
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
