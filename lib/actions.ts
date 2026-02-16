'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from './supabase-server';
import { DEFAULT_CATEGORIES, type CategoryConfig } from './category-registry';

/**
 * Deletes a transaction by its ID
 */
export async function deleteTransaction(transactionId: string) {
  try {
    const supabase = createServerClient();
    
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    revalidatePath('/');
    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Adds a manual transaction from a form
 * @param amount - Transaction amount
 * @param merchant - Merchant name
 * @param category - Transaction category
 * @param date - Transaction date (ISO string or Date object)
 * @param cardLast4 - Optional last 4 digits of card
 */
export async function addManualTransaction(
  amount: number,
  merchant: string,
  category: string,
  date: string | Date,
  cardLast4?: string
) {
  try {
    const supabase = createServerClient();
    
    // Convert date to ISO string if it's a Date object
    const dateString = date instanceof Date ? date.toISOString() : date;
    
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        amount: amount,
        merchant: merchant,
        category: category,
        card_last4: cardLast4 || null,
        created_at: dateString,
        include_in_insights: true,
      })
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    revalidatePath('/');
    return {
      success: true,
      transaction: data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Smart category update: Updates ALL transactions with the same merchant name
 * This allows the app to learn your preferences
 * @param merchant - Merchant name to update
 * @param newCategory - New category to apply to all transactions with this merchant
 */
export async function updateTransactionCategory(
  merchant: string,
  newCategory: string
) {
  try {
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('transactions')
      .update({ category: newCategory })
      .eq('merchant', merchant)
      .select();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    revalidatePath('/');
    return {
      success: true,
      updatedCount: data?.length || 0,
      transactions: data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Toggles the include_in_insights boolean for a specific transaction
 * @param transactionId - ID of the transaction to update
 * @param newValue - Optional: specific boolean value. If not provided, toggles current value
 */
export async function updateInsightToggle(
  transactionId: string,
  newValue?: boolean
) {
  try {
    const supabase = createServerClient();
    
    // If newValue is provided, use it; otherwise fetch current value and toggle
    let valueToSet: boolean;
    
    if (newValue !== undefined) {
      valueToSet = newValue;
    } else {
      // Fetch current value and toggle it
      const { data: currentTransaction, error: fetchError } = await supabase
        .from('transactions')
        .select('include_in_insights')
        .eq('id', transactionId)
        .single();

      if (fetchError) {
        return {
          success: false,
          error: fetchError.message,
        };
      }

      valueToSet = !currentTransaction.include_in_insights;
    }

    const { data, error } = await supabase
      .from('transactions')
      .update({ include_in_insights: valueToSet })
      .eq('id', transactionId)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    revalidatePath('/');
    return {
      success: true,
      transaction: data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Creates or updates a monthly budget for a specific month
 * @param month - Date string in format 'YYYY-MM-DD' (e.g., '2026-02-01')
 * @param amount - Budget amount for that month
 */
export async function upsertMonthlyBudget(month: string, amount: number) {
  try {
    const supabase = createServerClient();
    
    // Ensure month is in the correct format (first day of the month)
    const monthDate = new Date(month);
    const year = monthDate.getFullYear();
    const monthIndex = monthDate.getMonth();
    const firstDayOfMonth = new Date(year, monthIndex, 1);
    const monthString = firstDayOfMonth.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('monthly_budgets')
      .upsert(
        {
          month: monthString,
          amount: amount,
        },
        {
          onConflict: 'month',
        }
      )
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    revalidatePath('/');
    return {
      success: true,
      budget: data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Seed default categories into the `categories` table if it's empty.
 */
export async function ensureDefaultCategories() {
  try {
    const supabase = createServerClient();

    const { count, error: countError } = await supabase
      .from('categories')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      return { success: false, error: countError.message };
    }

    if ((count || 0) > 0) {
      return { success: true, seeded: false };
    }

    const rows = DEFAULT_CATEGORIES.map((c: CategoryConfig) => ({
      name: c.name,
      icon_key: c.icon_key,
      color_key: c.color_key,
    }));

    const { error } = await supabase.from('categories').insert(rows);
    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/');
    return { success: true, seeded: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}

export async function upsertCategory(input: { id?: string; name: string; icon_key: string; color_key: string }) {
  try {
    const supabase = createServerClient();
    const { id, ...rest } = input;

    const payload = id ? { id, ...rest } : rest;
    const { data, error } = await supabase
      .from('categories')
      .upsert(payload, { onConflict: 'name' })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath('/');
    return { success: true, category: data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}

export async function renameCategory(oldName: string, newName: string) {
  try {
    const supabase = createServerClient();

    // Update categories table
    const { error: catErr } = await supabase
      .from('categories')
      .update({ name: newName })
      .eq('name', oldName);
    if (catErr) return { success: false, error: catErr.message };

    // Update historical transactions
    const { error: txErr } = await supabase
      .from('transactions')
      .update({ category: newName })
      .eq('category', oldName);
    if (txErr) return { success: false, error: txErr.message };

    // Update merchant settings mappings
    const { error: msErr } = await supabase
      .from('merchant_settings')
      .update({ category_name: newName, updated_at: new Date().toISOString() })
      .eq('category_name', oldName);
    if (msErr) return { success: false, error: msErr.message };

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}

export async function upsertMerchantSetting(input: { merchant: string; category_name: string; image_url?: string | null }) {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('merchant_settings')
      .upsert(
        {
          merchant: input.merchant,
          category_name: input.category_name,
          image_url: input.image_url ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'merchant' }
      )
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath('/');
    return { success: true, merchantSetting: data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}
