'use client';

import { useState, useEffect, useRef } from 'react';
import { getMonthBudget, getMonthSpent, getDailySpending, getCategorySpending, getTransactions } from '@/lib/data';
import { upsertMonthlyBudget } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isWithinInterval } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { Edit2, Save, X, Settings, CreditCard } from 'lucide-react';
import TransactionDetailsModal from '@/components/transaction-details-modal';
import { Transaction } from '@/lib/data';
import { useSettings } from '@/components/settings-context';
import { getCategoryBadgeClass, getCategoryChartFill, getCategoryIconNode } from '@/lib/category-registry';

type Props = { onOpenSettings: () => void };

export default function BudgetTab({ onOpenSettings }: Props) {
  const router = useRouter();
  const { categories } = useSettings();
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

  // Make the donut order deterministic: highest first.
  // (Some data sources are already sorted, but we enforce it for the chart itself.)
  const donutCategoryData = [...categoryData].sort((a, b) => Number(b.amount) - Number(a.amount));

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
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-purple-900">Budget</h1>
          <button className="p-2" aria-label="Open settings" onClick={onOpenSettings} type="button">
            <Settings className="w-6 h-6 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Month Carousel */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => handleMonthChange('prev')}
            className="p-2 hover:bg-purple-100 rounded-full transition-colors"
            aria-label="Previous month"
            title="Previous month"
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
            aria-label="Next month"
            title="Next month"
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
                aria-label="Save budget"
                title="Save budget"
                >
                  <Save className="w-5 h-5" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                aria-label="Cancel editing budget"
                title="Cancel"
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
                aria-label="Edit budget"
                title="Edit budget"
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

      {/* Doughnut Chart (Category breakdown) */}
      {!loading && categoryData.length > 0 && (
        <div className="px-4 py-2">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Spending by Category</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      formatter={(value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    />
                    <Pie
                      data={donutCategoryData}
                      dataKey="amount"
                      nameKey="category"
                      innerRadius={70}
                      outerRadius={95}
                      paddingAngle={2}
                      stroke="white"
                      strokeWidth={2}
                    >
                      {donutCategoryData.map((entry: any) => (
                        <Cell
                          key={entry.category}
                          fill={getCategoryChartFill(entry.category, categories)}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {donutCategoryData.slice(0, 8).map((c: any) => (
                  <div key={c.category} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getCategoryChartFill(c.category, categories) }}
                        aria-hidden="true"
                      />
                      <span className="text-sm font-medium text-gray-900 truncate">{c.category}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-500">{Number(c.percentage).toFixed(1)}%</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {Number(c.amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                ))}
                {donutCategoryData.length > 8 && (
                  <div className="text-xs text-gray-500 pt-1">
                    +{donutCategoryData.length - 8} more categories
                  </div>
                )}
              </div>
            </div>
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
                    : '#9333ea'; // purple-600 for merchants

                const icon = groupBy === 'category' ? getCategoryIconNode(name, categories) : null;
                const color = groupBy === 'category' ? getCategoryBadgeClass(name, categories) : 'bg-purple-100 text-purple-700';

                return (
                  <div
                    key={index}
                    onClick={() => handleItemClick(item)}
                    className="relative overflow-hidden flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:shadow-md transition-all active:scale-[0.98] bg-gray-50"
                  >
                    {/* Relative bar (top item = 100%) */}
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
                    {!icon && (
                      <div className={`relative z-10 w-10 h-10 rounded-full ${color} flex items-center justify-center flex-shrink-0`}>
                        <CreditCard className="w-5 h-5" />
                      </div>
                    )}
                    <div className="relative z-10 flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{name}</p>
                      <p className="text-xs text-gray-500">
                        {(budget ? (amount / budget) * 100 : Number(item.percentage)).toFixed(1)}%
                        {budget ? ` of ${budget.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : ''}
                      </p>
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
