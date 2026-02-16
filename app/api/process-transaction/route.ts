import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

type SupportedCurrency = 'EGP' | 'USD' | 'EUR';
const OPENROUTER_MODEL = 'qwen/qwen3-235b-a22b-thinking-2507';
const fxCache: Partial<Record<SupportedCurrency, { rate: number; at: number }>> = {};

type AIExtraction = {
  merchant?: string | null;
  card_last4?: string | null;
  currency?: SupportedCurrency | null;
  amount?: number | null;
  category?: string | null;
  is_transfer?: boolean | null;
};

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

function normalizeCurrency(value: unknown): SupportedCurrency | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toUpperCase();
  if (v === '€') return 'EUR';
  if (v === 'EGP' || v === 'USD' || v === 'EUR') return v;
  return null;
}

function extractJsonObject(text: string): Record<string, any> | null {
  const direct = text.trim();
  try {
    return JSON.parse(direct);
  } catch {
    // fall through
  }

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function isLikelyTransferMessage(message: string): boolean {
  const checks = [
    /\btransfer\b/i,
    /\binstapay\b/i,
    /\biban\b/i,
    /\bswift\b/i,
    /\bsent to\b/i,
    /\breceived from\b/i,
    /\bwallet\b/i,
    /\bcash ?out\b/i,
  ];
  return checks.some((r) => r.test(message));
}

async function extractWithOpenRouter(message: string): Promise<AIExtraction | null> {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.qwen_api_key;
  if (!apiKey) return null;

  const prompt = `Extract transaction details from this bank message.
Return ONLY valid JSON (no markdown, no extra text) with this exact schema:
{
  "merchant": string|null,
  "card_last4": string|null,
  "currency": "EGP"|"USD"|"EUR"|null,
  "amount": number|null,
  "category": string|null,
  "is_transfer": boolean|null
}
Rules:
- merchant should be just merchant name, no date/time/limit text.
- If message looks like money transfer, set is_transfer=true and category="Transfers".
- If unknown, use null.
Message:
${message}`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a strict financial message parser that outputs only JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('OpenRouter error:', res.status, errText);
      return null;
    }

    const json: any = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) return null;

    const rawText =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('\n')
          : String(content);

    const parsed = extractJsonObject(rawText);
    if (!parsed) return null;

    const amount = Number(parsed.amount);
    return {
      merchant: typeof parsed.merchant === 'string' ? parsed.merchant.trim() : null,
      card_last4: typeof parsed.card_last4 === 'string' ? parsed.card_last4.trim() : null,
      currency: normalizeCurrency(parsed.currency),
      amount: Number.isFinite(amount) ? amount : null,
      category: typeof parsed.category === 'string' ? parsed.category.trim() : null,
      is_transfer: typeof parsed.is_transfer === 'boolean' ? parsed.is_transfer : null,
    };
  } catch (error) {
    console.error('OpenRouter extraction failed:', error);
    return null;
  }
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

  // Extract data using regex (bank SMS style)
  const cardMatch = message.match(/#(\d+)/);
  const charged = parseChargedAmount(message);
  const regexMerchant = parseMerchant(message);
  const ai = await extractWithOpenRouter(message);

  let cardNumber = cardMatch ? cardMatch[1] : (ai?.card_last4 ?? null);
  let originalCurrency: SupportedCurrency = charged?.currency ?? ai?.currency ?? 'EGP';
  let originalAmount: number = charged?.amount ?? ai?.amount ?? 0;
  let merchantName = regexMerchant ?? ai?.merchant ?? 'Unknown Merchant';
  const transferDetected = isLikelyTransferMessage(message) || ai?.is_transfer === true;

  // Convert currency to EGP if needed (limits in the SMS are ignored by design)
  let amountEgp: number = 0;
  try {
    const rate = await getToEgpRate(originalCurrency);
    amountEgp = Number((originalAmount * rate).toFixed(2));
  } catch (error) {
    // If FX lookup fails, keep value as-is so we still save the transaction.
    console.error('FX conversion failed, using original amount:', error);
    amountEgp = Number(originalAmount) || 0;
  }

  // Check if we've seen this merchant before
  const { data: existingTransactions, error: queryError } = merchantName !== 'Unknown Merchant'
    ? await supabase
        .from('transactions')
        .select('category')
        .eq('merchant', merchantName)
        .limit(1)
    : { data: null, error: null as any };

  let category: string = 'Other';

  if (queryError) {
    console.error('Error querying transactions:', queryError);
  }

  if (transferDetected) {
    merchantName = 'Transfer';
    category = 'Transfers';
  } else if (existingTransactions && existingTransactions.length > 0 && existingTransactions[0].category) {
    // Use cached category
    category = existingTransactions[0].category;
  } else {
    const validCategories = [
      'Food',
      'Transport',
      'Bills',
      'Shopping',
      'Entertainment',
      'Healthcare',
      'Education',
      'Transfers',
      'Other',
    ];
    const aiCategory = ai?.category ?? null;
    if (aiCategory && validCategories.includes(aiCategory)) {
      category = aiCategory;
    }
  }

  // Auto-filter: Check if merchant contains 'Transfer' or 'ATM'
  const includeInInsights =
    !merchantName.toLowerCase().includes('transfer') &&
    !merchantName.toLowerCase().includes('atm') &&
    category !== 'Transfers';

  // Save to Supabase
  const { data: transaction, error: insertError } = await supabase
    .from('transactions')
    .insert({
      card_last4: cardNumber || null,
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
      card_last4: cardNumber || null,
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
