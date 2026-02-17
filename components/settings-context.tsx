'use client';

import React, { createContext, useContext, useMemo, useCallback, useEffect, useState } from 'react';
import type { CategoryConfig } from '@/lib/category-registry';
import { DEFAULT_CATEGORIES } from '@/lib/category-registry';
import { getCategories, getMerchantSettings, type MerchantSettingRow } from '@/lib/data';

type MerchantSettingsMap = Record<string, MerchantSettingRow>;

type SettingsContextValue = {
  categories: CategoryConfig[];
  merchantSettings: MerchantSettingsMap;
  reloadSettings: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<CategoryConfig[]>(DEFAULT_CATEGORIES);
  const [merchantSettings, setMerchantSettings] = useState<MerchantSettingsMap>({});

  const reloadSettings = useCallback(async () => {
    const [cats, ms] = await Promise.all([getCategories(), getMerchantSettings()]);

    if (cats && cats.length > 0) {
      const fromDb = cats.map((c) => ({
        id: c.id,
        name: c.name,
        icon_key: c.icon_key as any,
        color_key: c.color_key as any,
      }));
      const existingNames = new Set(fromDb.map((c) => c.name));
      const merged = [...fromDb, ...DEFAULT_CATEGORIES.filter((c) => !existingNames.has(c.name))];
      setCategories(merged);
    } else {
      setCategories(DEFAULT_CATEGORIES);
    }

    const map: MerchantSettingsMap = {};
    for (const row of ms) {
      map[row.merchant] = row;
    }
    setMerchantSettings(map);
  }, []);

  useEffect(() => {
    // Initial load
    reloadSettings();
  }, [reloadSettings]);

  const value = useMemo(
    () => ({
      categories,
      merchantSettings,
      reloadSettings,
    }),
    [categories, merchantSettings, reloadSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
}

