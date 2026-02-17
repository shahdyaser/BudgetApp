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
  // Examples:
  // - "was charged for USD 20.00"
  // - "charged EGP 150.00"
  // - "Transfer reference ... of EGP 5000.00 has been debited ..."
  // Intentionally anchored around payment verbs/phrases to avoid picking up "available limit ... EGP ..."
  const m = message.match(
    /(?:charged(?:\s+for)?|of)\s+(EGP|USD|EUR|€)\s*([\d,]+(?:\.\d+)?)(?:\s+has\s+been\s+(?:debited|credited))?/i
  );
  if (m) {
    const raw = m[1].toUpperCase();
    const currency: SupportedCurrency = raw === '€' ? 'EUR' : (raw as SupportedCurrency);
    const amount = Number(m[2].replace(/,/g, ''));
    if (Number.isFinite(amount)) return { currency, amount };
  }

  // Arabic patterns:
  // - "تم خصم مبلغ  EGP 2070.00 ..."
  // - "تم تنفيذ تحويل ... بمبلغ 50.50 ج.م ..."
  const arabic1 = message.match(/(?:مبلغ|بمبلغ)\s*(EGP|USD|EUR|€)\s*([\d,]+(?:\.\d+)?)/i);
  if (arabic1) {
    const raw = arabic1[1].toUpperCase();
    const currency: SupportedCurrency = raw === '€' ? 'EUR' : (raw as SupportedCurrency);
    const amount = Number(arabic1[2].replace(/,/g, ''));
    if (Number.isFinite(amount)) return { currency, amount };
  }

  const arabic2 = message.match(/(?:مبلغ|بمبلغ)\s*([\d,]+(?:\.\d+)?)\s*(?:ج\.?\s*م|جنيه(?:\s*مصري)?|EGP)/i);
  if (arabic2) {
    const amount = Number(arabic2[1].replace(/,/g, ''));
    if (Number.isFinite(amount)) return { currency: 'EGP', amount };
  }

  return null;
}

function parseMerchant(message: string): string | null {
  // Prefer: "... at <MERCHANT> on <DATE> ..."
  const onDate = message.match(/\bat\s+(.+?)\s+on\s+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/i);
  if (onDate?.[1]) return onDate[1].trim();

  // Fallback: stop before a time / period / end
  const fallback = message.match(/\bat\s+(.+?)(?:\s+at\s+\d{1,2}:\d{2}\b|\.|$)/i);
  if (fallback?.[1]) return fallback[1].trim();

  // Arabic card debit patterns:
  // - "... عند SYMPL في 25/01/26 10:42 ..."
  const arabicAt = message.match(/عند\s+(.+?)\s+في\s+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i);
  if (arabicAt?.[1]) return arabicAt[1].trim();

  // - "... المنتهية بـ **5822 من BDC 6TH OF OCTOBER في 21/12/25 ..."
  // Prefer merchant right after the card suffix to avoid capturing "من بطاقة ..."
  const arabicFromAfterCard = message.match(
    /المنتهي(?:ة)?\s*ب(?:ـ)?\s*\*{0,4}\d{4}\s+من\s+(.+?)\s+في\s+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i
  );
  if (arabicFromAfterCard?.[1]) return arabicFromAfterCard[1].trim();

  // - Generic fallback: "... من <merchant> في <date> ..."
  const arabicFrom = message.match(/من\s+(.+?)\s+في\s+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/i);
  if (arabicFrom?.[1]) {
    const captured = arabicFrom[1].trim();
    // If capture still contains card text, keep only the final merchant segment.
    if (/بطاقة|المنتهي(?:ة)?\s*ب/i.test(captured) && /\s+من\s+/i.test(captured)) {
      const segments = captured.split(/\s+من\s+/i).map((s) => s.trim()).filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      if (lastSegment) return lastSegment;
    }
    return captured;
  }

  return null;
}

function parseCardLast4(message: string): string | null {
  // Standard card suffix form: #5233
  const hashCard = message.match(/#(\d{4})\b/);
  if (hashCard?.[1]) return hashCard[1];

  // Arabic card suffix form: **5822 or ****5822
  const maskedCard = message.match(/\*{2,}\s*(\d{4})\b/);
  if (maskedCard?.[1]) return maskedCard[1];

  // Arabic account ending form: "المنتهي ب 0001" / "المنتهية بـ 5822"
  const endingCard = message.match(/المنتهي(?:ة)?\s*ب(?:ـ)?\s*(\d{4})\b/i);
  if (endingCard?.[1]) return endingCard[1];

  return null;
}

function parseMessageTimestamp(message: string): string | null {
  // Supports:
  // - "... on 21/12/25 14:03 ..."
  // - "... في 21/12/25 14:03 ..."
  const match = message.match(
    /(?:\bon\b|في)\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+|T)(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i
  );
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const rawYear = Number(match[3]);
  let hour = Number(match[4]);
  const minute = Number(match[5]);
  const ampm = (match[6] ?? '').toUpperCase();
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;

  if (
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    !Number.isFinite(year) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  // Handle optional 12-hour suffix if present.
  if (ampm === 'AM' && hour === 12) hour = 0;
  if (ampm === 'PM' && hour < 12) hour += 12;

  const yyyy = String(year);
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const min = String(minute).padStart(2, '0');

  // Store as Egypt local timestamp (fixed +02:00 offset).
  // This avoids shifting late-night local transactions to after midnight in UI.
  const iso = `${yyyy}-${mm}-${dd}T${hh}:${min}:00+02:00`;

  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
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
    /تحويل/i,
    /تحويل\s+لحظي/i,
    /\binstapay\b/i,
    /ipn/i,
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
  const parsedCardLast4 = parseCardLast4(message);
  const charged = parseChargedAmount(message);
  const regexMerchant = parseMerchant(message);
  const parsedMessageTimestamp = parseMessageTimestamp(message);
  const transferDetectedByText = isLikelyTransferMessage(message);

  // Avoid unnecessary AI latency for clear transfer messages that already have amount/currency.
  const needAI =
    !transferDetectedByText &&
    (!regexMerchant || !charged);
  const ai = needAI ? await extractWithOpenRouter(message) : null;

  let cardNumber = parsedCardLast4 ?? (ai?.card_last4 ?? null);
  let originalCurrency: SupportedCurrency = charged?.currency ?? ai?.currency ?? 'EGP';
  let originalAmount: number = charged?.amount ?? ai?.amount ?? 0;
  let merchantName = regexMerchant ?? ai?.merchant ?? 'Unknown Merchant';
  const transferDetected = transferDetectedByText || ai?.is_transfer === true;

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
      'Subscriptions',
      'Installments',
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
      ...(parsedMessageTimestamp ? { created_at: parsedMessageTimestamp } : {}),
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
