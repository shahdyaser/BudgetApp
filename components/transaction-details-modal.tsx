'use client';

import { Transaction } from '@/lib/data';
import { format, parseISO } from 'date-fns';
import { X, Eye, EyeOff } from 'lucide-react';
import { updateInsightToggle } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { ShoppingCart, ShoppingBag, Utensils, Car, Receipt, Gamepad2, Stethoscope, GraduationCap, Plane, Hotel, Coffee, Music, CreditCard } from 'lucide-react';

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

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  title: string;
  totalAmount: number;
}

export default function TransactionDetailsModal({
  isOpen,
  onClose,
  transactions,
  title,
  totalAmount,
}: TransactionDetailsModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleToggleInsights = async (id: string, currentValue: boolean) => {
    const result = await updateInsightToggle(id, !currentValue);
    if (result.success) {
      router.refresh();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Total: {totalAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {transactions.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <p>No transactions found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => {
                const tDate = parseISO(transaction.created_at);
                const categoryIcon = categoryIcons[transaction.category] || categoryIcons['Other'];
                const categoryColor = categoryColors[transaction.category] || categoryColors['Other'];

                return (
                  <div
                    key={transaction.id}
                    className={`bg-white rounded-xl p-4 shadow-sm flex items-center gap-3 border ${
                      !transaction.include_in_insights ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Category Icon */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-full ${categoryColor} flex items-center justify-center`}>
                      {categoryIcon}
                    </div>

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
                          {format(tDate, 'MMM d, yyyy')}
                        </span>
                        <span className="text-xs text-gray-500">
                          {format(tDate, 'h:mm a')}
                        </span>
                        {transaction.card_last4 && (
                          <span className="text-xs text-gray-500">
                            #{transaction.card_last4}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Amount and Eye Icon */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleInsights(transaction.id, transaction.include_in_insights)}
                        className="p-1"
                      >
                        {transaction.include_in_insights ? (
                          <Eye className="w-5 h-5 text-purple-600" />
                        ) : (
                          <EyeOff className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      <span className="text-lg font-bold text-purple-600 whitespace-nowrap">
                        {Number(transaction.amount).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
