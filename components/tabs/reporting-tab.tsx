'use client';

import { useState, useEffect } from 'react';
import { getTransactions, getMonthBudget } from '@/lib/data';
import { useRouter } from 'next/navigation';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, isWithinInterval } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CreditCard, Settings } from 'lucide-react';
import TransactionDetailsModal from '@/components/transaction-details-modal';
import { Transaction } from '@/lib/data';
import { useSettings } from '@/components/settings-context';
import { getCategoryBadgeClass, getCategoryChartFill, getCategoryIconNode } from '@/lib/category-registry';

interface MonthlyData {
  month: string;
  spent: number;
  budget: number;
  saved: number;
}

type DeltaRow = {
  month: string;
  amount: number;
  delta: number | null;
  deltaPct: number | null;
};

type Props = { onOpenSettings: () => void };

export default function ReportingTab({ onOpenSettings }: Props) {
  const router = useRouter();
  const { categories, merchantSettings } = useSettings();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfMonth(new Date(2026, 0, 1)));
  const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfMonth(new Date()));
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalSaved, setTotalSaved] = useState(0);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [merchantData, setMerchantData] = useState<any[]>([]);
  const [groupBy, setGroupBy] = useState<'category' | 'merchant'>('category');
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<{ type: 'category' | 'merchant'; name: string } | null>(null);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [monthsInRange, setMonthsInRange] = useState<Date[]>([]);
  const [selectedDeltaCategory, setSelectedDeltaCategory] = useState<string>('');
  const [selectedDeltaMerchant, setSelectedDeltaMerchant] = useState<string>('__ALL__');

  useEffect(() => {
    if (dateFrom && dateTo) {
      loadData();
    }
  }, [dateFrom, dateTo]);

  const loadData = async () => {
    if (!dateFrom || !dateTo) return;

    setLoading(true);
    try {
      const transactionsData = await getTransactions();
      setAllTransactions(transactionsData);

      // Filter transactions by date range and include_in_insights
      const filteredTransactionsData = transactionsData.filter(t => {
        const tDate = parseISO(t.created_at);
        return isWithinInterval(tDate, { start: dateFrom, end: dateTo }) && t.include_in_insights;
      });

      setTransactions(filteredTransactionsData);

      // Get all months in the date range
      const months = eachMonthOfInterval({ start: dateFrom, end: dateTo });
      setMonthsInRange(months);

      // Calculate monthly data
      const monthlyDataPromises = months.map(async (month) => {
        const year = month.getFullYear();
        const monthIndex = month.getMonth();
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);

        // Get budget for this month
        const budgetData = await getMonthBudget(year, monthIndex);
        const budget = budgetData?.amount || 0;

        // Calculate spent for this month
        const monthTransactions = filteredTransactionsData.filter(t => {
          const tDate = parseISO(t.created_at);
          return tDate >= monthStart && tDate <= monthEnd;
        });

        const spent = monthTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const saved = budget > 0 ? (budget - spent) : 0; // Can be negative

        return {
          month: format(month, 'MMM yyyy'),
          spent,
          budget,
          saved,
        };
      });

      const monthlyDataResult = await Promise.all(monthlyDataPromises);
      setMonthlyData(monthlyDataResult);

      // Calculate totals
      const totalSpentValue = filteredTransactionsData.reduce((sum, t) => sum + Number(t.amount), 0);
      const totalBudgetValue = monthlyDataResult.reduce((sum, m) => sum + m.budget, 0);
      const totalSavedValue = totalBudgetValue - totalSpentValue; // Can be negative

      setTotalSpent(totalSpentValue);
      setTotalSaved(totalSavedValue);

      // Calculate category data
      const categoryMap = new Map<string, number>();
      filteredTransactionsData.forEach(t => {
        const current = categoryMap.get(t.category) || 0;
        categoryMap.set(t.category, current + Number(t.amount));
      });

      const categoryTotal = Array.from(categoryMap.values()).reduce((sum, amount) => sum + amount, 0);
      const categoryDataResult = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: categoryTotal > 0 ? (amount / categoryTotal) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      setCategoryData(categoryDataResult);

      // Calculate merchant data
      const merchantMap = new Map<string, number>();
      filteredTransactionsData.forEach(t => {
        const current = merchantMap.get(t.merchant) || 0;
        merchantMap.set(t.merchant, current + Number(t.amount));
      });

      const merchantTotal = Array.from(merchantMap.values()).reduce((sum, amount) => sum + amount, 0);
      const merchantDataResult = Array.from(merchantMap.entries())
        .map(([merchant, amount]) => ({
          merchant,
          amount,
          percentage: merchantTotal > 0 ? (amount / merchantTotal) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      setMerchantData(merchantDataResult);

      // Initialize delta selectors (category + merchant)
      const allCategories = Array.from(new Set(filteredTransactionsData.map(t => t.category))).sort();
      const nextCategory = allCategories.includes(selectedDeltaCategory)
        ? selectedDeltaCategory
        : (allCategories[0] || '');
      setSelectedDeltaCategory(nextCategory);

      const merchantsInCategory = nextCategory
        ? Array.from(new Set(filteredTransactionsData.filter(t => t.category === nextCategory).map(t => t.merchant))).sort()
        : [];
      const nextMerchant = merchantsInCategory.includes(selectedDeltaMerchant)
        ? selectedDeltaMerchant
        : '__ALL__';
      setSelectedDeltaMerchant(nextMerchant);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const topExpenditures = groupBy === 'category' ? categoryData : merchantData;

  const handleItemClick = (item: any) => {
    const name = groupBy === 'category' ? item.category : item.merchant;
    setSelectedItem({ type: groupBy, name });

    // Filter transactions for this category/merchant in the selected date range
    if (!dateFrom || !dateTo) return;

    const filtered = allTransactions.filter(t => {
      const tDate = parseISO(t.created_at);
      const matchesDate = isWithinInterval(tDate, { start: dateFrom, end: dateTo });
      const matchesFilter = groupBy === 'category' 
        ? t.category === name
        : t.merchant === name;
      return matchesDate && matchesFilter && t.include_in_insights;
    });

    setFilteredTransactions(filtered);
  };

  const selectedItemTotal = selectedItem 
    ? (groupBy === 'category' 
        ? categoryData.find(c => c.category === selectedItem.name)?.amount || 0
        : merchantData.find(m => m.merchant === selectedItem.name)?.amount || 0)
    : 0;

  const deltaCategories = Array.from(new Set(transactions.map(t => t.category))).sort();
  const deltaMerchants = selectedDeltaCategory
    ? Array.from(new Set(transactions.filter(t => t.category === selectedDeltaCategory).map(t => t.merchant))).sort()
    : [];

  const buildDeltaRows = (): DeltaRow[] => {
    if (!selectedDeltaCategory || monthsInRange.length === 0) return [];

    const series = monthsInRange.map((month) => {
      const start = startOfMonth(month);
      const end = endOfMonth(month);
      const monthTx = transactions.filter((t) => {
        const d = parseISO(t.created_at);
        const inMonth = d >= start && d <= end;
        const inCategory = t.category === selectedDeltaCategory;
        const inMerchant = selectedDeltaMerchant === '__ALL__' ? true : t.merchant === selectedDeltaMerchant;
        return inMonth && inCategory && inMerchant;
      });
      const amount = monthTx.reduce((sum, t) => sum + Number(t.amount), 0);
      return { month: format(month, 'MMM yyyy'), amount };
    });

    return series.map((cur, idx) => {
      if (idx === 0) {
        return { month: cur.month, amount: cur.amount, delta: null, deltaPct: null };
      }
      const prev = series[idx - 1];
      const delta = cur.amount - prev.amount;
      const deltaPct = prev.amount === 0 ? null : (delta / prev.amount) * 100;
      return { month: cur.month, amount: cur.amount, delta, deltaPct };
    });
  };

  const deltaRows = buildDeltaRows();

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-purple-100 to-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-purple-200/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-purple-900">Reporting</h1>
          <button className="p-2" aria-label="Open settings" onClick={onOpenSettings} type="button">
            <Settings className="w-6 h-6 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="px-4 py-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Date Range</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0 bg-gray-50 border border-gray-200 rounded-xl p-2">
              <label className="text-[11px] text-gray-500 mb-1 block">From</label>
              <input
                type="month"
                value={dateFrom ? format(dateFrom, 'yyyy-MM') : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const [year, month] = e.target.value.split('-');
                    setDateFrom(startOfMonth(new Date(parseInt(year), parseInt(month) - 1)));
                  }
                }}
                aria-label="From month"
                className="w-full min-w-0 px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="min-w-0 bg-gray-50 border border-gray-200 rounded-xl p-2">
              <label className="text-[11px] text-gray-500 mb-1 block">To</label>
              <input
                type="month"
                value={dateTo ? format(dateTo, 'yyyy-MM') : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const [year, month] = e.target.value.split('-');
                    setDateTo(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)));
                  }
                }}
                aria-label="To month"
                className="w-full min-w-0 px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Total Spent vs Saved Card */}
      <div className="px-4 py-2">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Total Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Spent</p>
              <p className="text-2xl font-bold text-gray-900">
                {totalSpent.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">
                {totalSaved >= 0 ? 'Total Saved' : 'Total Exceeded'}
              </p>
              <p className={`text-2xl font-bold ${totalSaved >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalSaved < 0 ? '-' : ''}{Math.abs(totalSaved).toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Comparison Graph */}
      {!loading && monthlyData.length > 0 && (
        <div className="px-4 py-2">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Spent vs Budget</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  formatter={(value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                />
                <Legend />
                <Bar 
                  dataKey="spent" 
                  name="Spent"
                  shape={(props: any) => {
                    const { payload, x, y, width, height } = props;
                    const exceeded = payload.spent > payload.budget;
                    return (
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        fill={exceeded ? '#ef4444' : '#9333ea'}
                        rx={4}
                      />
                    );
                  }}
                />
                <Bar dataKey="budget" fill="#9ca3af" name="Budget" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Category Monthly Delta Table (Inflation / Month-to-month changes) */}
      {!loading && monthsInRange.length > 0 && deltaCategories.length > 0 && (
        <div className="px-4 py-2">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Monthly Delta</h3>
              <div className="text-xs text-gray-500">MoM change</div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Category</label>
                <select
                  value={selectedDeltaCategory}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSelectedDeltaCategory(next);
                    setSelectedDeltaMerchant('__ALL__');
                  }}
                  aria-label="Select category for delta table"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  {deltaCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Merchant</label>
                <select
                  value={selectedDeltaMerchant}
                  onChange={(e) => setSelectedDeltaMerchant(e.target.value)}
                  aria-label="Select merchant for delta table"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="__ALL__">All (category total)</option>
                  {deltaMerchants.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {deltaRows.length === 0 ? (
              <div className="text-center text-gray-400 py-6 text-sm">No data for this selection</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
                      <th className="py-2 pr-3">Month</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Δ</th>
                      <th className="py-2">Δ%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deltaRows.map((r) => {
                      const deltaColor =
                        r.delta === null ? 'text-gray-400' : r.delta > 0 ? 'text-red-600' : r.delta < 0 ? 'text-green-600' : 'text-gray-600';
                      return (
                        <tr key={r.month} className="border-b last:border-b-0">
                          <td className="py-2 pr-3 font-medium text-gray-900 whitespace-nowrap">{r.month}</td>
                          <td className="py-2 pr-3 text-gray-900 whitespace-nowrap">
                            {r.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </td>
                          <td className={`py-2 pr-3 whitespace-nowrap ${deltaColor}`}>
                            {r.delta === null ? '—' : `${r.delta >= 0 ? '+' : ''}${r.delta.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                          </td>
                          <td className={`py-2 whitespace-nowrap ${deltaColor}`}>
                            {r.deltaPct === null ? '—' : `${r.deltaPct >= 0 ? '+' : ''}${r.deltaPct.toFixed(1)}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Expenditures */}
      {!loading && topExpenditures.length > 0 && (
        <div className="px-4 py-2">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Top Expenditures</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setGroupBy('category')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    groupBy === 'category'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Category
                </button>
                <button
                  onClick={() => setGroupBy('merchant')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    groupBy === 'merchant'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Merchant
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {topExpenditures.map((item, index) => {
                const name = groupBy === 'category' ? item.category : item.merchant;
                const maxAmount = Number(topExpenditures?.[0]?.amount) || 0;
                const amount = Number(item.amount) || 0;
                const fillPct = maxAmount > 0 ? Math.min(100, (amount / maxAmount) * 100) : 0;
                const barColor =
                  groupBy === 'category'
                    ? getCategoryChartFill(name, categories)
                    : '#9333ea';
                const icon = groupBy === 'category' ? getCategoryIconNode(name, categories) : null;
                const color =
                  groupBy === 'category'
                    ? getCategoryBadgeClass(name, categories)
                    : 'bg-purple-100 text-purple-700';
                const merchantImageUrl = groupBy === 'merchant' ? (merchantSettings[name]?.image_url ?? null) : null;

                return (
                  <div
                    key={index}
                    onClick={() => handleItemClick(item)}
                    className="relative overflow-hidden flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:shadow-md transition-all active:scale-[0.98] bg-gray-50"
                  >
                    <div className="absolute inset-0 bg-gray-50" />
                    <div
                      className="absolute inset-y-0 left-0"
                      style={{ width: `${fillPct}%`, backgroundColor: barColor, opacity: 0.22 }}
                      aria-hidden="true"
                    />

                    {icon && (
                      <div className={`relative z-10 w-10 h-10 rounded-full ${color} flex items-center justify-center flex-shrink-0`}>
                        {icon}
                      </div>
                    )}
                    {!icon && !merchantImageUrl && (
                      <div className={`relative z-10 w-10 h-10 rounded-full ${color} flex items-center justify-center flex-shrink-0`}>
                        <CreditCard className="w-5 h-5" />
                      </div>
                    )}
                    {!icon && merchantImageUrl && (
                      <div className="relative z-10 w-10 h-10 rounded-full overflow-hidden border border-gray-200 bg-white flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={merchantImageUrl} alt={name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="relative z-10 flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{name}</p>
                      <p className="text-xs text-gray-500">{item.percentage.toFixed(1)}%</p>
                    </div>
                    <div className="relative z-10 text-right">
                      <p className="font-bold text-gray-900">
                        {item.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <svg className="relative z-10 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="px-4 py-8 text-center text-gray-400">
          Loading...
        </div>
      )}

      {/* Transaction Details Modal */}
      {selectedItem && (
        <TransactionDetailsModal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          transactions={filteredTransactions}
          title={`${selectedItem.type === 'category' ? 'Category' : 'Merchant'}: ${selectedItem.name}`}
          totalAmount={selectedItemTotal}
        />
      )}
    </div>
  );
}
