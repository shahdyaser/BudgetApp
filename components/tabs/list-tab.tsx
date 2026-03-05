'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CreditCard, Eye, EyeOff, Filter, Settings, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getTransactionsPage, getUniqueCardNumbers, getUniqueMerchants, type Transaction } from '@/lib/data';
import { updateInsightToggle } from '@/lib/actions';
import TransactionEditModal from '@/components/transaction-edit-modal';
import { useSettings } from '@/components/settings-context';
import { getCategoryBadgeClass, getCategoryIconNode } from '@/lib/category-registry';

type Props = { onOpenSettings: () => void };

const PAGE_SIZE = 20;
type FilterState = {
  fromDate: string;
  toDate: string;
  category: string;
  merchant: string;
  cardLast4: string;
};

const EMPTY_FILTERS: FilterState = {
  fromDate: '',
  toDate: '',
  category: '',
  merchant: '',
  cardLast4: '',
};

export default function ListTab({ onOpenSettings }: Props) {
  const router = useRouter();
  const { categories, merchantSettings } = useSettings();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [merchantOptions, setMerchantOptions] = useState<string[]>([]);
  const [cardOptions, setCardOptions] = useState<string[]>([]);

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((v) => v !== ''),
    [filters]
  );

  const loadData = async (nextPage: number, append: boolean, activeFilters: FilterState) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    try {
      const payloadFilters = {
        fromDate: activeFilters.fromDate || undefined,
        toDate: activeFilters.toDate || undefined,
        category: activeFilters.category || undefined,
        merchant: activeFilters.merchant || undefined,
        cardLast4:
          activeFilters.cardLast4 === ''
            ? undefined
            : activeFilters.cardLast4 === '__CASH__'
              ? null
              : activeFilters.cardLast4,
      };
      const result = await getTransactionsPage(nextPage, PAGE_SIZE, payloadFilters);
      setTransactions((prev) => (append ? [...prev, ...result.transactions] : result.transactions));
      setHasMore(result.hasMore);
      setPage(nextPage);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    loadData(0, false, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [merchants, cards] = await Promise.all([getUniqueMerchants(), getUniqueCardNumbers()]);
        setMerchantOptions(merchants);
        setCardOptions(cards);
      } catch (error) {
        console.error('Error loading list filter options:', error);
      }
    })();
  }, []);

  const handleToggleInsights = async (id: string, currentValue: boolean) => {
    const result = await updateInsightToggle(id, !currentValue);
    if (result.success) {
      router.refresh();
      await loadData(0, false, filters);
    }
  };

  const applyFilters = async () => {
    setFilters(draftFilters);
    setIsFilterOpen(false);
    await loadData(0, false, draftFilters);
  };

  const clearFilters = async () => {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setIsFilterOpen(false);
    await loadData(0, false, EMPTY_FILTERS);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-purple-100 to-white pb-24">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-purple-200/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-purple-900">List</h1>
          <div className="flex items-center gap-1">
            <button
              className={`p-2 rounded-full ${hasActiveFilters ? 'bg-purple-100 text-purple-700' : ''}`}
              aria-label="Open filters"
              onClick={() => setIsFilterOpen(true)}
              type="button"
              title="Filters"
            >
              <Filter className="w-5 h-5" />
            </button>
            <button className="p-2" aria-label="Open settings" onClick={onOpenSettings} type="button">
              <Settings className="w-6 h-6 text-gray-700" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="text-center text-gray-400 py-12">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center text-gray-400 py-12">No transactions found</div>
        ) : (
          <>
            {transactions.map((transaction) => {
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

            {hasMore && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => loadData(page + 1, true, filters)}
                  disabled={isLoadingMore}
                  className="w-full rounded-xl border border-purple-200 bg-white py-2.5 text-sm font-semibold text-purple-700 hover:bg-purple-50 disabled:opacity-60"
                >
                  {isLoadingMore ? 'Loading...' : 'Show 20 more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {isFilterOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Filters</h3>
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-100"
                aria-label="Close filters"
                title="Close filters"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">From date</label>
                  <input
                    type="date"
                    value={draftFilters.fromDate}
                    onChange={(e) => setDraftFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                    aria-label="Filter from date"
                    title="From date"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">To date</label>
                  <input
                    type="date"
                    value={draftFilters.toDate}
                    onChange={(e) => setDraftFilters((prev) => ({ ...prev, toDate: e.target.value }))}
                    className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                    aria-label="Filter to date"
                    title="To date"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Category</label>
                <select
                  value={draftFilters.category}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  aria-label="Filter by category"
                  title="Category"
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Merchant</label>
                <select
                  value={draftFilters.merchant}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, merchant: e.target.value }))}
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  aria-label="Filter by merchant"
                  title="Merchant"
                >
                  <option value="">All merchants</option>
                  {merchantOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Card</label>
                <select
                  value={draftFilters.cardLast4}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, cardLast4: e.target.value }))}
                  className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  aria-label="Filter by card"
                  title="Card"
                >
                  <option value="">All cards</option>
                  <option value="__CASH__">Cash</option>
                  {cardOptions.map((c) => (
                    <option key={c} value={c}>#{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex gap-2">
              <button type="button" onClick={clearFilters} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700">
                Clear
              </button>
              <button type="button" onClick={applyFilters} className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      <TransactionEditModal
        transaction={selectedTransaction}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedTransaction(null);
        }}
        onUpdate={() => {
          loadData(0, false, filters);
        }}
      />
    </div>
  );
}
