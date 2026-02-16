'use client';

import { useState, useEffect } from 'react';
import { Transaction } from '@/lib/data';
import { updateTransactionCategory } from '@/lib/actions';
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

  useEffect(() => {
    if (transaction) {
      setSelectedCategory(transaction.category);
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const handleSave = async () => {
    if (selectedCategory) {
      const result = await updateTransactionCategory(transaction.merchant, selectedCategory);
      if (result.success) {
        router.refresh();
        onUpdate();
        onClose();
      } else {
        alert('Failed to update category: ' + result.error);
      }
    }
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
    </div>
  );
}
