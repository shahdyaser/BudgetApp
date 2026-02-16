'use client';

import { useState, useEffect, useRef } from 'react';
import { getMonthBudget, getMonthSpent, getDailySpending, getCategorySpending, getTransactions } from '@/lib/data';
import { upsertMonthlyBudget } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isWithinInterval } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Edit2, Save, X } from 'lucide-react';
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

export default function BudgetTab() {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [budget, setBudget] = useState<number | null>(null);
  const [spent, setSpent] = useState(0);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [merchantData, setMerchantData] = useState<any[]>([]);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [groupBy, setGroupBy] = useState<'category' | 'merchant'>('category');
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<{ type: 'category' | 'merchant'; name: string } | null>(null);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();

  useEffect(() => {
    loadData();
  }, [year, month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [budgetData, spentData, dailyDataResult, categoryDataResult, transactions] = await Promise.all([
        getMonthBudget(year, month),
        getMonthSpent(year, month),
        getDailySpending(year, month),
        getCategorySpending(year, month),
        getTransactions(),
      ]);

      setAllTransactions(transactions);

      setBudget(budgetData?.amount || null);
      setSpent(spentData);
      setDailyData(dailyDataResult);
      setCategoryData(categoryDataResult);

      // Calculate merchant data
      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
      const monthTransactions = transactions.filter(t => {
        const tDate = parseISO(t.created_at);
        return tDate >= firstDayOfMonth && tDate <= lastDayOfMonth && t.include_in_insights;
      });

      const merchantMap = new Map<string, number>();
      monthTransactions.forEach(t => {
        const current = merchantMap.get(t.merchant) || 0;
        merchantMap.set(t.merchant, current + Number(t.amount));
      });

      const total = Array.from(merchantMap.values()).reduce((sum, amount) => sum + amount, 0);
      const merchantDataResult = Array.from(merchantMap.entries())
        .map(([merchant, amount]) => ({
          merchant,
          amount,
          percentage: total > 0 ? (amount / total) * 100 : 0,
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

  const handleSaveBudget = async () => {
    const budgetAmount = parseFloat(budgetInput);
    if (isNaN(budgetAmount) || budgetAmount < 0) {
      alert('Please enter a valid budget amount');
      return;
    }

    const result = await upsertMonthlyBudget(
      `${year}-${String(month + 1).padStart(2, '0')}-01`,
      budgetAmount
    );

    if (result.success) {
      setBudget(budgetAmount);
      setIsEditingBudget(false);
      router.refresh();
      loadData();
    } else {
      alert('Failed to save budget: ' + result.error);
    }
  };

  const handleEditBudget = () => {
    setIsEditingBudget(true);
    setBudgetInput(budget?.toString() || '');
  };

  const handleCancelEdit = () => {
    setIsEditingBudget(false);
    setBudgetInput('');
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setSelectedMonth(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
  };

  const remaining = budget ? budget - spent : 0;
  const percentage = budget ? (spent / budget) * 100 : 0;
  const exceeded = remaining < 0 ? Math.abs(remaining) : 0;
  const saved = remaining >= 0 ? remaining : 0;

  // Prepare chart data
  const chartData = dailyData.map((item, index) => {
    const date = parseISO(item.date);
    const dayOfMonth = date.getDate();

    return {
      day: dayOfMonth,
      spent: item.total,
      budget: budget || 0, // Constant budget line at the set amount
    };
  });

  const topExpenditures = groupBy === 'category' ? categoryData : merchantData;

  const handleItemClick = (item: any) => {
    const name = groupBy === 'category' ? item.category : item.merchant;
    setSelectedItem({ type: groupBy, name });

    // Filter transactions for this category/merchant in the selected month
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    
    const filtered = allTransactions.filter(t => {
      const tDate = parseISO(t.created_at);
      const matchesDate = isWithinInterval(tDate, { start: monthStart, end: monthEnd });
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
        <h1 className="text-xl font-bold text-purple-900">Budget</h1>
      </div>

      {/* Month Carousel */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => handleMonthChange('prev')}
            className="p-2 hover:bg-purple-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-purple-600">
            {format(selectedMonth, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => handleMonthChange('next')}
            className="p-2 hover:bg-purple-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Budget Setting Card */}
      <div className="px-4 py-2">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          {isEditingBudget ? (
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Monthly Budget</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  placeholder="Enter budget amount"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handleSaveBudget}
                  className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
                >
                  <Save className="w-5 h-5" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Monthly Budget</p>
                <p className="text-2xl font-bold text-purple-600">
                  {budget ? budget.toLocaleString('en-US', { maximumFractionDigits: 0 }) : 'Not set'}
                </p>
              </div>
              <button
                onClick={handleEditBudget}
                className="p-2 hover:bg-purple-100 rounded-full transition-colors"
              >
                <Edit2 className="w-5 h-5 text-purple-600" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Card */}
      <div className="px-4 py-2">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-600">Total Spent</p>
              <p className="text-2xl font-bold text-gray-900">
                {spent.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="text-right">
              {budget ? (
                <>
                  {remaining >= 0 ? (
                    <>
                      <p className="text-sm text-green-600 font-medium">▼ Saved</p>
                      <p className="text-xl font-bold text-green-600">
                        {saved.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-red-600 font-medium">▲ Exceeded</p>
                      <p className="text-xl font-bold text-red-600">
                        -{exceeded.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </p>
                    </>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {percentage.toFixed(1)}% of budget
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500">Set budget to track</p>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {budget && (
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full transition-all ${
                  percentage >= 100 ? 'bg-red-500' : percentage >= 90 ? 'bg-orange-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Graph */}
      {budget && !loading && dailyData.length > 0 && (
        <div className="px-4 py-2">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Spending Trend</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => value.toString()}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  formatter={(value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  labelFormatter={(label) => `Day ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="spent" 
                  stroke="#9333ea" 
                  strokeWidth={2}
                  name="Current month"
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="budget" 
                  stroke="#9ca3af" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Budget"
                  dot={false}
                />
              </LineChart>
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
