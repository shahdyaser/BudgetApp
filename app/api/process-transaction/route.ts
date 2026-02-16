import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSupabaseClient } from '@/lib/supabase';

function getGenAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
  }
  return new GoogleGenerativeAI(key);
}

type SupportedCurrency = 'EGP' | 'USD' | 'EUR';
const fxCache: Partial<Record<SupportedCurrency, { rate: number; at: number }>> = {};

async function getToEgpRate(currency: SupportedCurrency): Promise<number> {
  if (currency === 'EGP') return 1;

  // 1) Prefer explicit env vars (most reliable)
  const envKey = currency === 'USD' ? 'USD_TO_EGP_RATE' : 'EUR_TO_EGP_RATE';
  const fromEnv = process.env[envKey];
  if (fromEnv) {
    const n = Number(fromEnv);
    if (Number.isFinite(n) && n > 0) return n;
  }

  // 2) Otherwise try a free public rates endpoint at runtime
  // Cache for 6 hours to avoid repeated calls on warm lambdas.
  const now = Date.now();
  const cached = fxCache[currency];
  if (cached && now - cached.at < 6 * 60 * 60 * 1000) {
    return cached.rate;
  }

  const res = await fetch(`https://open.er-api.com/v6/latest/${currency}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch FX rate (${currency}->EGP): HTTP ${res.status}`);
  }
  const json: any = await res.json();
  const rate = json?.rates?.EGP;
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Failed to fetch FX rate (${currency}->EGP): missing EGP rate`);
  }
  fxCache[currency] = { rate, at: now };
  return rate;
}

function parseChargedAmount(message: string): { currency: SupportedCurrency; amount: number } | null {
  // Example: "was charged for USD 20.00" OR "charged EGP 150.00" OR "charged for EUR 10.00" OR "charged for € 10.00"
  // Intentionally anchored around the word "charged" so we don't accidentally pick up "Available limit ... EGP 153068"
  const m = message.match(/charged(?:\s+for)?\s+(EGP|USD|EUR|€)\s*([\d,]+(?:\.\d+)?)/i);
  if (!m) return null;
  const raw = m[1].toUpperCase();
  const currency: SupportedCurrency = raw === '€' ? 'EUR' : (raw as SupportedCurrency);
  const amount = Number(m[2].replace(/,/g, ''));
  if (!Number.isFinite(amount)) return null;
  return { currency, amount };
}

function parseMerchant(message: string): string | null {
  // Prefer: "... at <MERCHANT> on <DATE> ..."
  const onDate = message.match(/\bat\s+(.+?)\s+on\s+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/i);
  if (onDate?.[1]) return onDate[1].trim();

  // Fallback: stop before a time / period / end
  const fallback = message.match(/\bat\s+(.+?)(?:\s+at\s+\d{1,2}:\d{2}\b|\.|$)/i);
  if (fallback?.[1]) return fallback[1].trim();

  return null;
}

async function readMessage(request: NextRequest): Promise<string | null> {
  const contentType = request.headers.get('content-type') ?? '';

  // JSON body: { "message": "..." }
  if (contentType.includes('application/json')) {
    try {
      const body = await request.json();
      const message = body?.message;
      return typeof message === 'string' && message.trim() ? message : null;
    } catch {
      return null;
    }
  }

  // Plain text body: "credit card #5233 charged EGP 150.00 at Starbucks"
  try {
    const text = await request.text();
    return text && text.trim() ? text : null;
  } catch {
    return null;
  }
}

async function handleMessage(message: string) {
  const supabase = getSupabaseClient();
  const genAI = getGenAI();

  // Extract data using regex (bank SMS style)
  const cardMatch = message.match(/#(\d+)/);
  const charged = parseChargedAmount(message);
  const merchantName = parseMerchant(message);

  const cardNumber = cardMatch ? cardMatch[1] : null;

  if (!cardNumber || !charged || !merchantName) {
    return NextResponse.json(
      { error: 'Could not extract required information from message' },
      { status: 400 }
    );
  }

  // Convert currency to EGP if needed (limits in the SMS are ignored by design)
  let amountEgp: number;
  let originalCurrency: SupportedCurrency = charged.currency;
  let originalAmount: number = charged.amount;

  const rate = await getToEgpRate(charged.currency);
  amountEgp = Number((charged.amount * rate).toFixed(2));

  // Check if we've seen this merchant before
  const { data: existingTransactions, error: queryError } = await supabase
    .from('transactions')
    .select('category')
    .eq('merchant', merchantName)
    .limit(1);

  let category: string;

  if (queryError) {
    console.error('Error querying transactions:', queryError);
  }

  if (existingTransactions && existingTransactions.length > 0 && existingTransactions[0].category) {
    // Use cached category
    category = existingTransactions[0].category;
  } else {
    // Use Gemini AI to categorize
    try {
      // Use gemini-1.5-flash model (or fallback to gemini-pro)
      // Note: Model availability depends on your API key
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        // Alternative: try 'gemini-pro' if the above doesn't work
      });

      const prompt = `Categorize this transaction merchant into one of these categories: Food, Transport, Bills, Shopping, Entertainment, Healthcare, Education, Other.

Merchant name: ${merchantName}

Respond with ONLY the category name, nothing else.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      category = response.text().trim();

      // Validate category (fallback to 'Other' if not recognized)
      const validCategories = ['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Healthcare', 'Education', 'Other'];
      if (!validCategories.includes(category)) {
        category = 'Other';
      }
    } catch (aiError: any) {
      console.error('Gemini AI error:', aiError);
      // If model not found, try gemini-pro as fallback
      if (aiError?.message?.includes('404') || aiError?.message?.includes('not found')) {
        try {
          const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-pro' });
          const prompt = `Categorize this transaction merchant into one of these categories: Food, Transport, Bills, Shopping, Entertainment, Healthcare, Education, Other.

Merchant name: ${merchantName}

Respond with ONLY the category name, nothing else.`;
          const result = await fallbackModel.generateContent(prompt);
          const response = await result.response;
          category = response.text().trim();
          const validCategories = ['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Healthcare', 'Education', 'Other'];
          if (!validCategories.includes(category)) {
            category = 'Other';
          }
        } catch (fallbackError) {
          console.error('Fallback model also failed:', fallbackError);
          category = 'Other';
        }
      } else {
        // Fallback to 'Other' if AI fails for other reasons
        category = 'Other';
      }
    }
  }

  // Auto-filter: Check if merchant contains 'Transfer' or 'ATM'
  const includeInInsights =
    !merchantName.toLowerCase().includes('transfer') &&
    !merchantName.toLowerCase().includes('atm');

  // Save to Supabase
  const { data: transaction, error: insertError } = await supabase
    .from('transactions')
    .insert({
      card_last4: cardNumber,
      amount: amountEgp,
      merchant: merchantName,
      category: category,
      include_in_insights: includeInInsights,
      raw_text: message,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error inserting transaction:', insertError);
    return NextResponse.json(
      { error: 'Failed to save transaction', details: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    transaction: {
      id: transaction.id,
      card_last4: cardNumber,
      amount: amountEgp,
      original_currency: originalCurrency,
      original_amount: originalAmount,
      merchant: merchantName,
      category: category,
      include_in_insights: includeInInsights,
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const message = request.nextUrl.searchParams.get('message');
    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'message query param is required' }, { status: 400 });
    }
    return await handleMessage(message);
  } catch (error) {
    console.error('Error processing transaction:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const message = await readMessage(request);

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    return await handleMessage(message);
  } catch (error) {
    console.error('Error processing transaction:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
