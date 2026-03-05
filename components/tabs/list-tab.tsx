'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CreditCard, Eye, EyeOff, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getTransactions, type Transaction } from '@/lib/data';
import { updateInsightToggle } from '@/lib/actions';
import TransactionEditModal from '@/components/transaction-edit-modal';
import { useSettings } from '@/components/settings-context';
import { getCategoryBadgeClass, getCategoryIconNode } from '@/lib/category-registry';

type Props = { onOpenSettings: () => void };

const PAGE_SIZE = 20;

export default function ListTab({ onOpenSettings }: Props) {
  const router = useRouter();
  const { categories, merchantSettings } = useSettings();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const txns = await getTransactions();
      setTransactions(txns);
      setVisibleCount(PAGE_SIZE);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, transactions.length));
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [transactions.length]);

  const visibleTransactions = useMemo(
    () => transactions.slice(0, visibleCount),
    [transactions, visibleCount]
  );

  const hasMore = visibleCount < transactions.length;

  const handleToggleInsights = async (id: string, currentValue: boolean) => {
    const result = await updateInsightToggle(id, !currentValue);
    if (result.success) {
      router.refresh();
      await loadData();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-purple-100 to-white pb-24">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-purple-200/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-purple-900">List</h1>
          <button className="p-2" aria-label="Open settings" onClick={onOpenSettings} type="button">
            <Settings className="w-6 h-6 text-gray-700" />
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="text-center text-gray-400 py-12">Loading...</div>
        ) : visibleTransactions.length === 0 ? (
          <div className="text-center text-gray-400 py-12">No transactions found</div>
        ) : (
          <>
            {visibleTransactions.map((transaction) => {
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
                  {merchantImageUrl ? (
                    <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden border border-gray-200 bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={merchantImageUrl} alt={transaction.merchant} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${categoryColor}`}>
                      {categoryIcon}
                    </div>
                  )}

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
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">
                        {transaction.card_last4 ? `#${transaction.card_last4}` : 'Cash'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(tDate, 'dd MMM yyyy, h:mm a')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleInsights(transaction.id, transaction.include_in_insights);
                      }}
                      className="p-1"
                      aria-label={transaction.include_in_insights ? 'Exclude from insights' : 'Include in insights'}
                      title={transaction.include_in_insights ? 'Included in insights' : 'Excluded from insights'}
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
            })}

            <div ref={sentinelRef} className="h-1" />
            {hasMore && (
              <div className="text-center text-xs text-gray-500 py-2">Scroll to load more...</div>
            )}
          </>
        )}
      </div>

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
    </div>
  );
}
