'use client';

import { Transaction } from '@/lib/data';
import { format, parseISO } from 'date-fns';
import { X } from 'lucide-react';

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
  if (!isOpen) return null;

  const sorted = [...transactions].sort(
    (a, b) => parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime()
  );

  const groups: Array<{ dayKey: string; day: Date; total: number; items: Transaction[] }> = [];
  for (const t of sorted) {
    const dt = parseISO(t.created_at);
    const dayKey = format(dt, 'yyyy-MM-dd');
    const last = groups[groups.length - 1];
    if (!last || last.dayKey !== dayKey) {
      groups.push({ dayKey, day: dt, total: Number(t.amount) || 0, items: [t] });
    } else {
      last.items.push(t);
      last.total += Number(t.amount) || 0;
    }
  }

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
            <div className="space-y-5">
              {groups.map((g, idx) => {
                const isAlt = idx % 2 === 1;
                const groupBg = isAlt ? 'bg-gray-50' : 'bg-white';
                const rowBg = isAlt ? 'bg-white' : 'bg-gray-50';

                return (
                  <div
                    key={g.dayKey}
                    className={`rounded-2xl p-3 border border-gray-200/60 ${groupBg}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-500">
                        {format(g.day, 'EEE, MMM d yyyy').toUpperCase()}
                      </p>
                      <p className="text-xs font-semibold text-gray-700">
                        {g.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </p>
                    </div>

                    <div className="space-y-2">
                      {g.items.map((t) => (
                        <div
                          key={t.id}
                          className={`${rowBg} rounded-xl px-3 py-2 flex items-center justify-between gap-3 ${
                            !t.include_in_insights ? 'opacity-60' : ''
                          }`}
                        >
                          <p className="text-sm font-medium text-gray-900 truncate">{t.merchant}</p>
                          <p className="text-sm font-semibold text-purple-600 whitespace-nowrap">
                            {Number(t.amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      ))}
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
