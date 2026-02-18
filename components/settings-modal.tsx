'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Settings as SettingsIcon, Upload, Bell } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase';
import { ensureDefaultCategories, renameCategory, upsertCategory, upsertMerchantSetting, updateTransactionCategory } from '@/lib/actions';
import { getMerchantDefaultCategories, getUniqueMerchants } from '@/lib/data';
import { COLOR_OPTIONS, ICON_OPTIONS, type ColorKey, type IconKey } from '@/lib/category-registry';
import { useSettings } from '@/components/settings-context';

type Props = {
  isOpen: boolean;
  onCloseAction: () => void;
};

export default function SettingsModal({ isOpen, onCloseAction }: Props) {
  const { categories, merchantSettings, reloadSettings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'categories' | 'merchants'>('categories');
  const [merchants, setMerchants] = useState<string[]>([]);
  const [merchantDefaults, setMerchantDefaults] = useState<Record<string, string>>({});
  const [merchantQuery, setMerchantQuery] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [notificationStatus, setNotificationStatus] = useState<'idle' | 'enabled' | 'unsupported'>('idle');

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState<IconKey>('credit_card');
  const [newCategoryColor, setNewCategoryColor] = useState<ColorKey>('gray');

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      setLoading(true);
      try {
        // Make sure we have defaults at least once.
        await ensureDefaultCategories();
        await reloadSettings();
        const m = await getUniqueMerchants();
        setMerchants(m);
        const defaults = await getMerchantDefaultCategories();
        setMerchantDefaults(defaults);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const supported =
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window;

    if (!supported) {
      setNotificationStatus('unsupported');
      return;
    }

    if (Notification.permission === 'granted') {
      setNotificationStatus('enabled');
    } else {
      setNotificationStatus('idle');
    }
  }, [isOpen]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  const filteredCategories = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    const base = sortedCategories;
    if (!q) return base;
    return base.filter((c) => c.name.toLowerCase().includes(q));
  }, [sortedCategories, categoryQuery]);

  const filteredMerchants = useMemo(() => {
    const q = merchantQuery.trim().toLowerCase();
    const base = q ? merchants.filter((m) => m.toLowerCase().includes(q)) : merchants;
    return [...base].sort((a, b) => a.localeCompare(b));
  }, [merchants, merchantQuery]);

  if (!isOpen) return null;

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;

    setLoading(true);
    try {
      const res = await upsertCategory({ name, icon_key: newCategoryIcon, color_key: newCategoryColor });
      if (!res.success) {
        alert(res.error);
        return;
      }
      setNewCategoryName('');
      setNewCategoryIcon('credit_card');
      setNewCategoryColor('gray');
      await reloadSettings();
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (oldName: string, newName: string) => {
    const next = newName.trim();
    if (!next || next === oldName) return;
    setLoading(true);
    try {
      const res = await renameCategory(oldName, next);
      if (!res.success) {
        alert(res.error);
        return;
      }
      await reloadSettings();
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategoryConfig = async (name: string, icon_key: IconKey, color_key: ColorKey) => {
    setLoading(true);
    try {
      const res = await upsertCategory({ name, icon_key, color_key });
      if (!res.success) {
        alert(res.error);
        return;
      }
      await reloadSettings();
    } finally {
      setLoading(false);
    }
  };

  const uploadMerchantImage = async (merchant: string, file: File) => {
    const fileToDataUrl = (input: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(input);
      });

    const supabase = getSupabaseClient();
    const ext = file.name.split('.').pop() || 'jpg';
    const pathSafe = merchant.replace(/[^a-z0-9]+/gi, '-').slice(0, 60).toLowerCase();
    const objectPath = `${pathSafe}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('merchant-images')
      .upload(objectPath, file, { upsert: true, contentType: file.type || 'image/jpeg' });

    if (uploadError) {
      // Fallback for environments where storage bucket/policies are not ready.
      return await fileToDataUrl(file);
    }

    const { data } = supabase.storage.from('merchant-images').getPublicUrl(objectPath);
    if (!data?.publicUrl) {
      return await fileToDataUrl(file);
    }

    return data.publicUrl;
  };

  const handleMerchantCategoryChange = async (merchant: string, category_name: string) => {
    setLoading(true);
    try {
      // Update historical transactions for this merchant
      const res1 = await updateTransactionCategory(merchant, category_name);
      if (!res1.success) {
        alert(res1.error);
        return;
      }
      // Persist mapping
      const res2 = await upsertMerchantSetting({
        merchant,
        category_name,
        image_url: merchantSettings[merchant]?.image_url ?? null,
      });
      if (!res2.success) {
        alert(res2.error);
        return;
      }
      await reloadSettings();
    } finally {
      setLoading(false);
    }
  };

  const handleMerchantPhoto = async (merchant: string, file: File) => {
    setLoading(true);
    try {
      const url = await uploadMerchantImage(merchant, file);
      const category_name =
        merchantSettings[merchant]?.category_name ??
        merchantDefaults[merchant] ??
        categories.find((c) => c.name === 'Other')?.name ??
        'Other';

      const res = await upsertMerchantSetting({ merchant, category_name, image_url: url });
      if (!res.success) {
        alert(res.error);
        return;
      }
      await reloadSettings();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to upload merchant photo');
    } finally {
      setLoading(false);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const handleEnableNotifications = async () => {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      alert('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY in environment.');
      return;
    }

    const supported =
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window;

    if (!supported) {
      setNotificationStatus('unsupported');
      alert('Push notifications are not supported on this browser/device.');
      return;
    }

    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Notification permission was not granted.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      const currentSub = await registration.pushManager.getSubscription();
      const subscription =
        currentSub ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));

      const res = await fetch('/api/push-subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to save push subscription');
      }

      setNotificationStatus('enabled');
      alert('Notifications are enabled. You will receive a push for each transaction.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to enable notifications');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">Settings</h2>
          </div>
          <button onClick={onCloseAction} className="p-2 hover:bg-gray-100 rounded-full" aria-label="Close settings">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {loading && (
            <div className="text-sm text-gray-500">Saving…</div>
          )}

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-purple-600" />
                  iOS Push Notifications
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {notificationStatus === 'enabled'
                    ? 'Enabled for this device.'
                    : notificationStatus === 'unsupported'
                      ? 'Not supported on this device/browser.'
                      : 'Enable to receive a push for each transaction.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleEnableNotifications}
                disabled={loading || notificationStatus === 'enabled' || notificationStatus === 'unsupported'}
                className="px-3 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {notificationStatus === 'enabled' ? 'Enabled' : 'Enable'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
            <div className="grid grid-cols-2">
              <button
                type="button"
                onClick={() => setActiveTab('categories')}
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === 'categories' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600'
                }`}
                aria-label="Show categories settings"
              >
                Categories
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('merchants')}
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === 'merchants' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600'
                }`}
                aria-label="Show merchants settings"
              >
                Merchants
              </button>
            </div>
          </div>

          {activeTab === 'categories' && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Categories</h3>
              <input
                value={categoryQuery}
                onChange={(e) => setCategoryQuery(e.target.value)}
                placeholder="Search categories…"
                className="w-full px-3 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3"
              />
              <div className="space-y-3">
                {filteredCategories.map((c) => {
                  const Icon = ICON_OPTIONS[c.icon_key as IconKey]?.Icon;
                  const badgeClass = COLOR_OPTIONS[c.color_key as ColorKey]?.badgeClass ?? COLOR_OPTIONS.gray.badgeClass;
                  return (
                    <div key={c.name} className="p-3 rounded-xl bg-gray-50 border border-gray-200/60">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${badgeClass} flex items-center justify-center flex-shrink-0`}>
                          {Icon ? <Icon className="w-5 h-5" /> : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <input
                            defaultValue={c.name}
                            onBlur={(e) => handleRename(c.name, e.target.value)}
                            className="w-full bg-transparent font-semibold text-gray-900 outline-none border-b border-transparent focus:border-purple-300"
                            aria-label={`Rename category ${c.name}`}
                          />
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <select
                              value={c.icon_key as any}
                              onChange={(e) => handleUpdateCategoryConfig(c.name, e.target.value as IconKey, c.color_key as ColorKey)}
                              className="px-2 py-2 rounded-xl border border-gray-200 bg-white text-sm"
                              aria-label={`Icon for ${c.name}`}
                            >
                              {Object.entries(ICON_OPTIONS).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                              ))}
                            </select>
                            <select
                              value={c.color_key as any}
                              onChange={(e) => handleUpdateCategoryConfig(c.name, c.icon_key as IconKey, e.target.value as ColorKey)}
                              className="px-2 py-2 rounded-xl border border-gray-200 bg-white text-sm"
                              aria-label={`Color for ${c.name}`}
                            >
                              {Object.entries(COLOR_OPTIONS).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add category */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-500 mb-2">Add new category</p>
                <div className="grid grid-cols-1 gap-2">
                  <input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Category name"
                    className="px-3 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newCategoryIcon}
                      onChange={(e) => setNewCategoryIcon(e.target.value as IconKey)}
                      className="px-3 py-3 rounded-xl border border-gray-300 bg-white"
                      aria-label="New category icon"
                    >
                      {Object.entries(ICON_OPTIONS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                    <select
                      value={newCategoryColor}
                      onChange={(e) => setNewCategoryColor(e.target.value as ColorKey)}
                      className="px-3 py-3 rounded-xl border border-gray-300 bg-white"
                      aria-label="New category color"
                    >
                      {Object.entries(COLOR_OPTIONS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleAddCategory}
                    disabled={!newCategoryName.trim() || loading}
                    className="px-4 py-3 rounded-xl bg-purple-600 text-white font-medium disabled:opacity-50"
                  >
                    Add category
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'merchants' && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Merchants</h3>
              <input
                value={merchantQuery}
                onChange={(e) => setMerchantQuery(e.target.value)}
                placeholder="Search merchants…"
                className="w-full px-3 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3"
              />

              <div className="space-y-3">
                {filteredMerchants.map((m) => {
                  const ms = merchantSettings[m];
                  const imageUrl = ms?.image_url ?? null;
                  const currentCat = ms?.category_name ?? merchantDefaults[m] ?? 'Other';
                  return (
                    <div key={m} className="p-3 rounded-xl bg-gray-50 border border-gray-200/60">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                          {imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imageUrl} alt={m} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs text-gray-400">IMG</span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{m}</p>
                          <div className="grid grid-cols-1 gap-2 mt-2">
                            <select
                              value={currentCat}
                              onChange={(e) => handleMerchantCategoryChange(m, e.target.value)}
                              className="px-2 py-2 rounded-xl border border-gray-200 bg-white text-sm"
                              aria-label={`Category for merchant ${m}`}
                            >
                              {sortedCategories.map((c) => (
                                <option key={c.name} value={c.name}>{c.name}</option>
                              ))}
                            </select>

                            <label className="inline-flex items-center gap-2 text-sm text-purple-700 font-medium cursor-pointer">
                              <Upload className="w-4 h-4" />
                              <span>Upload photo</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleMerchantPhoto(m, file);
                                  e.currentTarget.value = '';
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!loading && filteredMerchants.length === 0 && (
                  <div className="text-sm text-gray-500 text-center py-6">No merchants found</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

