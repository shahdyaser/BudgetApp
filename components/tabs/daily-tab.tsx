'use client';

import { useState, useEffect, useRef } from 'react';
import { Transaction } from '@/lib/data';
import { getTransactions, getUniqueCardNumbers } from '@/lib/data';
import { updateInsightToggle } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns';
import { Eye, EyeOff, Plus, Settings } from 'lucide-react';
import TransactionEditModal from '@/components/transaction-edit-modal';
import AddTransactionModal from '@/components/add-transaction-modal';
import { useSettings } from '@/components/settings-context';
import { getCategoryBadgeClass, getCategoryIconNode } from '@/lib/category-registry';

interface DayData {
  date: Date;
  total: number;
}

type Props = { onOpenSettings: () => void };

export default function DailyTab({ onOpenSettings }: Props) {
  const router = useRouter();
  const { categories, merchantSettings } = useSettings();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cardNumbers, setCardNumbers] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedCard, setSelectedCard] = useState<string>('all');
  const [daysData, setDaysData] = useState<DayData[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    calculateDaysData();
  }, [transactions, currentMonth, selectedCard]);

  // Set today as selected date on mount only once
  useEffect(() => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today);
    setHasInitialized(true);
  }, []);

  const loadData = async () => {
    try {
      const [txns, cards] = await Promise.all([
        getTransactions(),
        getUniqueCardNumbers(),
      ]);
      setTransactions(txns);
      setCardNumbers(cards);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const calculateDaysData = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    const data = days.map(day => {
      const dayTransactions = transactions.filter(t => {
        const tDate = parseISO(t.created_at);
        const matchesDate = isSameDay(tDate, day);
        const matchesCard = selectedCard === 'all' || 
          (selectedCard === 'cash' && !t.card_last4) ||
          (selectedCard !== 'cash' && t.card_last4 === selectedCard);
        // Daily totals should include all transactions (even excluded from insights/budget)
        return matchesDate && matchesCard;
      });

      const total = dayTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      return { date: day, total };
    });

    setDaysData(data);
  };

  const setMonth = (month: Date) => {
    const nextMonth = startOfMonth(month);
    setCurrentMonth(nextMonth);

    // If the selected day isn't in that month, move it to the 1st of the month.
    if (!isSameMonth(selectedDate, nextMonth)) {
      setSelectedDate(nextMonth);
    }
  };

  const formatCompactNumber = (num: number): string => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return Math.round(num).toLocaleString('en-US'); // Comma separated, no decimals for numbers less than 1000
  };

  const handleToggleInsights = async (id: string, currentValue: boolean) => {
    const result = await updateInsightToggle(id, !currentValue);
    if (result.success) {
      router.refresh();
      loadData();
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const tDate = parseISO(t.created_at);
    const matchesDate = isSameDay(tDate, selectedDate);
    const matchesCard = selectedCard === 'all' || 
      (selectedCard === 'cash' && !t.card_last4) ||
      (selectedCard !== 'cash' && t.card_last4 === selectedCard);
    return matchesDate && matchesCard;
  });

  // Daily total includes all transactions (even excluded from insights/budget)
  const todayTotal = filteredTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

  const scrollToSelectedDay = () => {
    if (scrollRef.current && daysData.length > 0) {
      const selectedIndex = daysData.findIndex(d => isSameDay(d.date, selectedDate));
      if (selectedIndex !== -1) {
        const dayElement = scrollRef.current.children[selectedIndex] as HTMLElement;
        if (dayElement) {
          dayElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    }
  };

  useEffect(() => {
    scrollToSelectedDay();
  }, [selectedDate, daysData]);

  // Scroll to selected date when daysData loads (but don't change selectedDate)
  useEffect(() => {
    if (daysData.length > 0 && hasInitialized) {
      setTimeout(() => {
        scrollToSelectedDay();
      }, 100);
    }
  }, [daysData, hasInitialized]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-purple-100 to-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-purple-200/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-purple-900">Daily Transactions</h1>
          <button className="p-2" aria-label="Open settings" onClick={onOpenSettings} type="button">
            <Settings className="w-6 h-6 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Month Display */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonth(subMonths(currentMonth, 1))}
              className="w-10 h-10 rounded-xl bg-white shadow-sm border border-purple-100 flex items-center justify-center text-purple-700 active:scale-[0.98]"
              aria-label="Previous month"
              type="button"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setMonth(addMonths(currentMonth, 1))}
              className="w-10 h-10 rounded-xl bg-white shadow-sm border border-purple-100 flex items-center justify-center text-purple-700 active:scale-[0.98]"
              aria-label="Next month"
              type="button"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-purple-600">
              {format(currentMonth, 'MMMM yyyy').toUpperCase()}
            </h2>
          </div>
        </div>
      </div>

      {/* Days Carousel */}
      <div className="px-4 py-4">
        <div 
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {daysData.map((dayData, index) => {
            const isSelected = isSameDay(dayData.date, selectedDate);
            return (
              <button
                key={index}
                onClick={() => setSelectedDate(dayData.date)}
                className={`flex-shrink-0 flex flex-col items-center justify-center px-4 py-3 rounded-2xl min-w-[70px] transition-all ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 shadow-sm'
                }`}
              >
                <span className={`text-xs font-medium ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                  {format(dayData.date, 'EEE').toUpperCase()}
                </span>
                <span className={`text-xl font-bold mt-1 ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                  {format(dayData.date, 'd')}
                </span>
                <span className={`text-xs mt-1 ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                  {dayData.total > 0 ? formatCompactNumber(dayData.total) : '0'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Card Filter Pills */}
      <div className="px-4 py-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setSelectedCard('all')}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCard === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-purple-600 border border-purple-200'
            }`}
          >
            All
          </button>
          {cardNumbers.map(card => (
            <button
              key={card}
              onClick={() => setSelectedCard(card)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCard === card
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-purple-600 border border-purple-200'
              }`}
            >
              #{card}
            </button>
          ))}
          <button
            onClick={() => setSelectedCard('cash')}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCard === 'cash'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-purple-600 border border-purple-200'
            }`}
          >
            Cash
          </button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="px-4 py-4 space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <p>No transactions for this day</p>
          </div>
        ) : (
          filteredTransactions.map((transaction) => {
            const tDate = parseISO(transaction.created_at);
            const categoryIcon = getCategoryIconNode(transaction.category, categories);
            const categoryColor = getCategoryBadgeClass(transaction.category, categories);
            const merchantImageUrl = merchantSettings[transaction.merchant]?.image_url ?? null;

            return (
              <div
                key={transaction.id}
                onClick={() => {
                  setSelectedTransaction(transaction);
                  setIsEditModalOpen(true);
                }}
                className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
              >
                {/* Merchant image if available, otherwise category icon */}
                {merchantImageUrl ? (
                  <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden border border-gray-200 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={merchantImageUrl}
                      alt={transaction.merchant}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${categoryColor}`}>
                    {categoryIcon}
                  </div>
                )}

                {/* Transaction Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {transaction.merchant}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor}`}>
                      {transaction.category.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(tDate, 'h:mm a')}
                    </span>
                  </div>
                </div>

                {/* Amount and Eye Icon */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleInsights(transaction.id, transaction.include_in_insights);
                    }}
                    className="p-1"
                  >
                    {transaction.include_in_insights ? (
                      <Eye className="w-5 h-5 text-purple-600" />
                    ) : (
                      <EyeOff className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  <span className="text-lg font-bold text-purple-600 whitespace-nowrap">
                    {Number(transaction.amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Today's Total and Add Button */}
      <div className="fixed bottom-20 left-0 right-0 px-4 py-4 bg-white/80 backdrop-blur-lg border-t border-purple-200/50">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Today's Total</p>
            <p className="text-2xl font-bold text-purple-600">
              {todayTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="w-14 h-14 rounded-full bg-purple-600 text-white shadow-lg flex items-center justify-center hover:bg-purple-700 transition-colors"
            aria-label="Add transaction"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Edit Transaction Modal */}
      <TransactionEditModal
        transaction={selectedTransaction}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedTransaction(null);
        }}
        onUpdate={() => {
          loadData();
        }}
      />

      {/* Add Transaction Modal */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
}
