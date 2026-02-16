'use client';

import { useState } from 'react';
import DailyTab from '@/components/tabs/daily-tab';
import BudgetTab from '@/components/tabs/budget-tab';
import ReportingTab from '@/components/tabs/reporting-tab';
import { Home, Wallet, BarChart3 } from 'lucide-react';

type TabType = 'daily' | 'budget' | 'reporting';

export default function MobileApp() {
  const [activeTab, setActiveTab] = useState<TabType>('daily');

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-purple-100 to-white flex flex-col">
      {/* Status Bar Simulation */}
      <div className="h-6 bg-transparent" />
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'daily' && <DailyTab />}
        {activeTab === 'budget' && <BudgetTab />}
        {activeTab === 'reporting' && <ReportingTab />}
      </div>

      {/* Bottom Tab Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-purple-200/50 shadow-lg z-20">
        <div className="flex justify-around items-center h-20 px-2 max-w-md mx-auto">
          {/* Daily Tab */}
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-all ${
              activeTab === 'daily'
                ? 'text-purple-600'
                : 'text-gray-400'
            }`}
          >
            <Home className={`h-6 w-6 mb-1 ${activeTab === 'daily' ? 'text-purple-600' : 'text-gray-400'}`} />
            <span className={`text-xs font-medium ${activeTab === 'daily' ? 'text-purple-600' : 'text-gray-400'}`}>
              Daily
            </span>
          </button>

          {/* Budget Tab */}
          <button
            onClick={() => setActiveTab('budget')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-all ${
              activeTab === 'budget'
                ? 'text-purple-600'
                : 'text-gray-400'
            }`}
          >
            <Wallet className={`h-6 w-6 mb-1 ${activeTab === 'budget' ? 'text-purple-600' : 'text-gray-400'}`} />
            <span className={`text-xs font-medium ${activeTab === 'budget' ? 'text-purple-600' : 'text-gray-400'}`}>
              Budget
            </span>
          </button>

          {/* Reporting Tab */}
          <button
            onClick={() => setActiveTab('reporting')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-all ${
              activeTab === 'reporting'
                ? 'text-purple-600'
                : 'text-gray-400'
            }`}
          >
            <BarChart3 className={`h-6 w-6 mb-1 ${activeTab === 'reporting' ? 'text-purple-600' : 'text-gray-400'}`} />
            <span className={`text-xs font-medium ${activeTab === 'reporting' ? 'text-purple-600' : 'text-gray-400'}`}>
              Reporting
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
