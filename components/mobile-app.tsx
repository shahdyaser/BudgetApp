'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import DailyTab from '@/components/tabs/daily-tab';
import BudgetTab from '@/components/tabs/budget-tab';
import ReportingTab from '@/components/tabs/reporting-tab';
import ListTab from '@/components/tabs/list-tab';
import { Home, Wallet, BarChart3, List } from 'lucide-react';
import SettingsModal from '@/components/settings-modal';
import { SettingsProvider } from '@/components/settings-context';

type TabType = 'daily' | 'budget' | 'reporting' | 'list';

export default function MobileApp() {
  const [activeTab, setActiveTab] = useState<TabType>('budget');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isSplashFading, setIsSplashFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setIsSplashFading(true);
    }, 1900);
    const hideTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2200);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <SettingsProvider>
      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-purple-100 to-white flex flex-col">
        {showSplash && (
          <div
            className={`fixed inset-0 z-50 bg-gradient-to-br from-purple-700 via-purple-600 to-violet-600 flex items-center justify-center transition-opacity duration-300 ${
              isSplashFading ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div className="flex flex-col items-center text-white animate-pulse">
              <div className="w-28 h-28 rounded-3xl shadow-2xl overflow-hidden ring-2 ring-white/20">
                <Image
                  src="/app-icon.png"
                  alt="Budget App logo"
                  width={112}
                  height={112}
                  priority
                />
              </div>
              <h1 className="mt-5 text-2xl font-bold tracking-wide">Budget App</h1>
              <p className="mt-1 text-sm text-white/80">Track. Budget. Grow.</p>
            </div>
          </div>
        )}

        {/* Status Bar Simulation */}
        <div className="h-6 bg-transparent" />

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto pb-20">
          {activeTab === 'daily' && <DailyTab onOpenSettings={() => setIsSettingsOpen(true)} />}
          {activeTab === 'budget' && <BudgetTab onOpenSettings={() => setIsSettingsOpen(true)} />}
          {activeTab === 'reporting' && <ReportingTab onOpenSettings={() => setIsSettingsOpen(true)} />}
          {activeTab === 'list' && <ListTab onOpenSettings={() => setIsSettingsOpen(true)} />}
        </div>

        <SettingsModal isOpen={isSettingsOpen} onCloseAction={() => setIsSettingsOpen(false)} />

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

            {/* List Tab */}
            <button
              onClick={() => setActiveTab('list')}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all ${
                activeTab === 'list'
                  ? 'text-purple-600'
                  : 'text-gray-400'
              }`}
            >
              <List className={`h-6 w-6 mb-1 ${activeTab === 'list' ? 'text-purple-600' : 'text-gray-400'}`} />
              <span className={`text-xs font-medium ${activeTab === 'list' ? 'text-purple-600' : 'text-gray-400'}`}>
                List
              </span>
            </button>
          </div>
        </div>
      </div>
    </SettingsProvider>
  );
}
