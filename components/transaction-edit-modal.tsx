'use client';

import { useState, useEffect } from 'react';
import { Transaction } from '@/lib/data';
import { updateTransactionAmount, updateTransactionCategory } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useSettings } from '@/components/settings-context';
import { getCategoryBadgeClass, getCategoryIconNode } from '@/lib/category-registry';

interface TransactionEditModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function TransactionEditModal({
  transaction,
  isOpen,
  onClose,
  onUpdate,
}: TransactionEditModalProps) {
  const router = useRouter();
  const { categories } = useSettings();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [showScopeConfirm, setShowScopeConfirm] = useState(false);

  useEffect(() => {
    if (transaction) {
      setSelectedCategory(transaction.category);
      setAmountInput(String(Number(transaction.amount)));
      setShowScopeConfirm(false);
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const handleSave = async () => {
    if (!selectedCategory) return;

    const parsedAmount = Number(amountInput);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid amount greater than 0.');
      return;
    }

    const amountChanged = Number(parsedAmount.toFixed(2)) !== Number(Number(transaction.amount).toFixed(2));
    const categoryChanged = selectedCategory !== transaction.category;

    if (!amountChanged && !categoryChanged) {
      onClose();
      return;
    }

    if (amountChanged && !categoryChanged) {
      const amountResult = await updateTransactionAmount(transaction.id, Number(parsedAmount.toFixed(2)));
      if (!amountResult.success) {
        alert('Failed to update amount: ' + amountResult.error);
        return;
      }
      router.refresh();
      onUpdate();
      onClose();
      return;
    }

    setShowScopeConfirm(true);
  };

  const applyCategoryChange = async (scope: 'single' | 'merchant') => {
    if (!selectedCategory) return;

    const parsedAmount = Number(amountInput);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid amount greater than 0.');
      return;
    }
    const normalizedAmount = Number(parsedAmount.toFixed(2));
    const amountChanged = normalizedAmount !== Number(Number(transaction.amount).toFixed(2));

    const result = await updateTransactionCategory(transaction.merchant, selectedCategory, {
      scope,
      transactionId: transaction.id,
    });
    if (!result.success) {
      alert('Failed to update category: ' + result.error);
      return;
    }

    // Amount is always transaction-specific, even if category is merchant-wide.
    if (amountChanged) {
      const amountResult = await updateTransactionAmount(transaction.id, normalizedAmount);
      if (!amountResult.success) {
        alert('Category updated, but amount update failed: ' + amountResult.error);
        return;
      }
    }

    setShowScopeConfirm(false);
    router.refresh();
    onUpdate();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Edit Transaction</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transaction Info */}
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              {getCategoryIconNode(transaction.category, categories)}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{transaction.merchant}</h3>
              <p className="text-sm text-gray-500">
                {new Date(transaction.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div className="text-right">
            <p className="text-lg font-bold text-purple-600">
              {Number(transaction.amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
            </div>
          </div>
        </div>

        {/* Category Selection */}
        <div className="px-4 py-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Amount</h3>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            className="w-full px-3 py-3 rounded-xl border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
            aria-label="Transaction amount"
          />

          <h3 className="text-sm font-semibold text-gray-700 mb-3">Select Category</h3>
          
          {/* Existing Categories */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {categories.map((category) => {
              const badge = getCategoryBadgeClass(category.name, categories);
              const icon = getCategoryIconNode(category.name, categories);
              return (
              <button
                key={category.name}
                onClick={() => {
                  setSelectedCategory(category.name);
                }}
                className={`p-3 rounded-xl border-2 transition-all ${
                  selectedCategory === category.name
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-200 bg-white hover:border-purple-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-full ${badge} flex items-center justify-center mx-auto mb-2`}>
                  {icon}
                </div>
                <p className={`text-xs font-medium ${
                  selectedCategory === category.name
                    ? 'text-purple-600'
                    : 'text-gray-700'
                }`}>
                  {category.name}
                </p>
              </button>
            )})}
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedCategory}
            className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
          >
            Save
          </button>
        </div>
      </div>

      {showScopeConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">Apply category change</h3>
            <p className="mt-2 text-sm text-gray-600">
              Apply this category to only this transaction or to all transactions for this merchant?
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => applyCategoryChange('single')}
                className="w-full rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
              >
                This transaction only
              </button>
              <button
                type="button"
                onClick={() => applyCategoryChange('merchant')}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                All this merchant&apos;s transactions
              </button>
              <button
                type="button"
                onClick={() => setShowScopeConfirm(false)}
                className="w-full rounded-xl px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
