import { NextRequest, NextResponse } from 'next/server';
import { getMonthBudget, getMonthSpent } from '@/lib/data';

function parseMonthParam(value: string | null): { year: number; monthIndex: number } | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, monthIndex: month - 1 };
}

export async function GET(request: NextRequest) {
  try {
    const parsed = parseMonthParam(request.nextUrl.searchParams.get('month'));
    const now = new Date();
    const year = parsed?.year ?? now.getFullYear();
    const monthIndex = parsed?.monthIndex ?? now.getMonth();

    const [budgetRow, spent] = await Promise.all([
      getMonthBudget(year, monthIndex),
      getMonthSpent(year, monthIndex),
    ]);

    const budget = Number(budgetRow?.amount ?? 0);
    const remaining = budget - spent;
    const saved = remaining >= 0 ? remaining : 0;
    const exceeded = remaining < 0 ? Math.abs(remaining) : 0;
    const progressPercent = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

    return NextResponse.json({
      month: monthKey,
      spent,
      budget,
      saved,
      exceeded,
      progressPercent: Number(progressPercent.toFixed(2)),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
