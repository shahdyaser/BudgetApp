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

  // Extract data using regex
  // Pattern: 'credit card #5233 charged EGP 150.00 at Starbucks'
  const cardMatch = message.match(/#(\d+)/);
  const amountMatch = message.match(/EGP\s+([\d,]+\.?\d*)/i);
  const merchantMatch = message.match(/at\s+(.+?)(?:\.|$)/i);

  const cardNumber = cardMatch ? cardMatch[1] : null;
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;
  const merchantName = merchantMatch ? merchantMatch[1].trim() : null;

  if (!cardNumber || amount === null || !merchantName) {
    return NextResponse.json(
      { error: 'Could not extract required information from message' },
      { status: 400 }
    );
  }

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
      amount: amount,
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
      amount: amount,
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
