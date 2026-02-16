'use client';

import { useMemo, useState, useEffect } from 'react';
import { addManualTransaction } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { useSettings } from '@/components/settings-context';
import { getCategoryBadgeClass, getCategoryIconNode } from '@/lib/category-registry';
import { getMerchantDefaultCategories, getUniqueMerchants } from '@/lib/data';

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
  const { categories, merchantSettings } = useSettings();
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [merchantOptions, setMerchantOptions] = useState<string[]>([]);
  const [merchantDefaults, setMerchantDefaults] = useState<Record<string, string>>({});
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
      setSelectedCategory('Other');
      const now = new Date();
      setTimestamp(format(now, "yyyy-MM-dd'T'HH:mm"));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      const [merchants, defaults] = await Promise.all([
        getUniqueMerchants(),
        getMerchantDefaultCategories(),
      ]);
      setMerchantOptions(merchants.sort((a, b) => a.localeCompare(b)));
      setMerchantDefaults(defaults);
    })();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const m = merchant.trim();
    if (!m) {
      setSelectedCategory('Other');
      return;
    }

    const fromSettings = merchantSettings[m]?.category_name;
    const fromHistory = merchantDefaults[m];
    const next = fromSettings || fromHistory || 'Other';

    // Only allow categories that exist (fallback to Other)
    const exists = categories.some((c) => c.name === next);
    setSelectedCategory(exists ? next : 'Other');
  }, [merchant, merchantDefaults, merchantSettings, categories, isOpen]);

  const categoryBadge = useMemo(
    () => getCategoryBadgeClass(selectedCategory || 'Other', categories),
    [selectedCategory, categories]
  );
  const categoryIcon = useMemo(
    () => getCategoryIconNode(selectedCategory || 'Other', categories),
    [selectedCategory, categories]
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !merchant) {
      alert('Please fill in all required fields');
      return;
    }

    const amountNum = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await addManualTransaction(
        amountNum,
        merchant.trim(),
        selectedCategory || 'Other',
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
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoComplete="off"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg"
              required
            />
          </div>

          {/* Merchant (dropdown + searchable) */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Merchant *
            </label>
            <input
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Start typing to search…"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
              list="merchant-list"
            />
            <datalist id="merchant-list">
              {merchantOptions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          {/* Category (auto from merchant) */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Category
            </label>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${categoryBadge} flex items-center justify-center`}>
                {categoryIcon}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {selectedCategory || 'Other'}
                </p>
                <p className="text-xs text-gray-500">Auto-selected from merchant</p>
              </div>
            </div>
          </div>

          {/* Timestamp */}
          <div>
            <label htmlFor="add-txn-datetime" className="text-sm font-medium text-gray-700 mb-2 block">
              Date & Time *
            </label>
            <input
              id="add-txn-datetime"
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
              disabled={isSubmitting || !amount || !merchant}
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
