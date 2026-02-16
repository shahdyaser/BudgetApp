'use client';

import { useState, useEffect } from 'react';
import { getTransactions, getMonthBudget } from '@/lib/data';
import { useRouter } from 'next/navigation';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, isWithinInterval } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ShoppingCart, ShoppingBag, Utensils, Car, Receipt, Gamepad2, Stethoscope, GraduationCap, Plane, Hotel, Coffee, Music, CreditCard } from 'lucide-react';
import TransactionDetailsModal from '@/components/transaction-details-modal';
import { Transaction } from '@/lib/data';

const categoryIcons: Record<string, React.ReactNode> = {
  'Food': <Utensils className="w-5 h-5" />,
  'Shopping': <ShoppingBag className="w-5 h-5" />,
  'Groceries': <ShoppingCart className="w-5 h-5" />,
  'Transport': <Car className="w-5 h-5" />,
  'Bills': <Receipt className="w-5 h-5" />,
  'Entertainment': <Gamepad2 className="w-5 h-5" />,
  'Healthcare': <Stethoscope className="w-5 h-5" />,
  'Education': <GraduationCap className="w-5 h-5" />,
  'Travel': <Plane className="w-5 h-5" />,
  'Accommodation': <Hotel className="w-5 h-5" />,
  'Coffee': <Coffee className="w-5 h-5" />,
  'Music': <Music className="w-5 h-5" />,
  'Other': <CreditCard className="w-5 h-5" />,
};

const categoryColors: Record<string, string> = {
  'Food': 'bg-orange-100 text-orange-700',
  'Shopping': 'bg-pink-100 text-pink-700',
  'Groceries': 'bg-green-100 text-green-700',
  'Transport': 'bg-blue-100 text-blue-700',
  'Bills': 'bg-red-100 text-red-700',
  'Entertainment': 'bg-pink-100 text-pink-700',
  'Healthcare': 'bg-teal-100 text-teal-700',
  'Education': 'bg-yellow-100 text-yellow-700',
  'Travel': 'bg-indigo-100 text-indigo-700',
  'Accommodation': 'bg-cyan-100 text-cyan-700',
  'Coffee': 'bg-amber-100 text-amber-700',
  'Music': 'bg-violet-100 text-violet-700',
  'Other': 'bg-gray-100 text-gray-700',
};

interface MonthlyData {
  month: string;
  spent: number;
  budget: number;
  saved: number;
}

export default function ReportingTab() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 5); // Default to last 6 months
    return startOfMonth(date);
  });
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-purple-100 to-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-purple-200/50 px-4 py-3">
        <h1 className="text-xl font-bold text-purple-900">Reporting</h1>
      </div>

      {/* Date Range Selector */}
      <div className="px-4 py-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Date Range</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">From</label>
              <input
                type="month"
                value={dateFrom ? format(dateFrom, 'yyyy-MM') : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const [year, month] = e.target.value.split('-');
                    setDateFrom(startOfMonth(new Date(parseInt(year), parseInt(month) - 1)));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">To</label>
              <input
                type="month"
                value={dateTo ? format(dateTo, 'yyyy-MM') : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const [year, month] = e.target.value.split('-');
                    setDateTo(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                const icon = groupBy === 'category' 
                  ? (categoryIcons[name] || categoryIcons['Other'])
                  : null;
                const color = groupBy === 'category'
                  ? (categoryColors[name] || categoryColors['Other'])
                  : 'bg-purple-100 text-purple-700';

                return (
                  <div
                    key={index}
                    onClick={() => handleItemClick(item)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:shadow-md transition-all active:scale-[0.98] ${
                      index === 0 ? (groupBy === 'category' ? 'bg-pink-50' : 'bg-purple-50') : 'bg-gray-50'
                    }`}
                  >
                    {icon && (
                      <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center flex-shrink-0`}>
                        {icon}
                      </div>
                    )}
                    {!icon && (
                      <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center flex-shrink-0`}>
                        <CreditCard className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{name}</p>
                      <p className="text-xs text-gray-500">{item.percentage.toFixed(1)}%</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">
                        {item.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
