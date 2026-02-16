'use client';

import { useState, useEffect } from 'react';
import { addManualTransaction } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { X, ShoppingCart, ShoppingBag, Fuel, Utensils, Car, Home, CreditCard, Receipt, Heart, Gamepad2, GraduationCap, Stethoscope, Music, Coffee, Plane, Hotel } from 'lucide-react';
import { format } from 'date-fns';

interface CategoryOption {
  name: string;
  icon: React.ReactNode;
  color: string;
}

const defaultCategories: CategoryOption[] = [
  { name: 'Food', icon: <Utensils className="w-5 h-5" />, color: 'bg-orange-100 text-orange-700' },
  { name: 'Groceries', icon: <ShoppingCart className="w-5 h-5" />, color: 'bg-green-100 text-green-700' },
  { name: 'Shopping', icon: <ShoppingBag className="w-5 h-5" />, color: 'bg-purple-100 text-purple-700' },
  { name: 'Transport', icon: <Car className="w-5 h-5" />, color: 'bg-blue-100 text-blue-700' },
  { name: 'Bills', icon: <Receipt className="w-5 h-5" />, color: 'bg-red-100 text-red-700' },
  { name: 'Entertainment', icon: <Gamepad2 className="w-5 h-5" />, color: 'bg-pink-100 text-pink-700' },
  { name: 'Healthcare', icon: <Stethoscope className="w-5 h-5" />, color: 'bg-teal-100 text-teal-700' },
  { name: 'Education', icon: <GraduationCap className="w-5 h-5" />, color: 'bg-yellow-100 text-yellow-700' },
  { name: 'Travel', icon: <Plane className="w-5 h-5" />, color: 'bg-indigo-100 text-indigo-700' },
  { name: 'Accommodation', icon: <Hotel className="w-5 h-5" />, color: 'bg-cyan-100 text-cyan-700' },
  { name: 'Coffee', icon: <Coffee className="w-5 h-5" />, color: 'bg-amber-100 text-amber-700' },
  { name: 'Music', icon: <Music className="w-5 h-5" />, color: 'bg-violet-100 text-violet-700' },
  { name: 'Other', icon: <CreditCard className="w-5 h-5" />, color: 'bg-gray-100 text-gray-700' },
];

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddTransactionModal({
  isOpen,
  onClose,
  onSuccess,
}: AddTransactionModalProps) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [timestamp, setTimestamp] = useState(() => {
    const now = new Date();
    return format(now, "yyyy-MM-dd'T'HH:mm");
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setAmount('');
      setMerchant('');
      setSelectedCategory('');
      const now = new Date();
      setTimestamp(format(now, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !merchant || !selectedCategory) {
      alert('Please fill in all required fields');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await addManualTransaction(
        amountNum,
        merchant,
        selectedCategory,
        new Date(timestamp),
        undefined // No card number - cash transaction
      );

      if (result.success) {
        router.refresh();
        onSuccess();
        onClose();
      } else {
        alert('Failed to add transaction: ' + result.error);
      }
    } catch (error) {
      alert('An error occurred: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Add Transaction</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
          {/* Amount */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Amount *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg"
              required
            />
          </div>

          {/* Merchant Name */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Merchant Name *
            </label>
            <input
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Enter merchant name"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          {/* Category Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Category *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {defaultCategories.map((category) => (
                <button
                  key={category.name}
                  type="button"
                  onClick={() => setSelectedCategory(category.name)}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    selectedCategory === category.name
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 bg-white hover:border-purple-300'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full ${category.color} flex items-center justify-center mx-auto mb-2`}>
                    {category.icon}
                  </div>
                  <p className={`text-xs font-medium ${
                    selectedCategory === category.name
                      ? 'text-purple-600'
                      : 'text-gray-700'
                  }`}>
                    {category.name}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Timestamp */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Date & Time *
            </label>
            <input
              type="datetime-local"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          {/* Cash Indicator */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
            <p className="text-sm text-purple-700 font-medium">
              💵 This transaction will be added as Cash
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !amount || !merchant || !selectedCategory}
              className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Adding...' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
