import React from 'react';
import {
  Utensils,
  ShoppingBag,
  ShoppingCart,
  Car,
  Receipt,
  Gamepad2,
  Stethoscope,
  GraduationCap,
  Plane,
  Hotel,
  Coffee,
  Music,
  CreditCard,
  Home,
  type LucideIcon,
} from 'lucide-react';

export type CategoryConfig = {
  id?: string;
  name: string;
  icon_key: IconKey;
  color_key: ColorKey;
};

export type IconKey =
  | 'utensils'
  | 'shopping_bag'
  | 'shopping_cart'
  | 'car'
  | 'receipt'
  | 'gamepad'
  | 'stethoscope'
  | 'graduation_cap'
  | 'plane'
  | 'hotel'
  | 'coffee'
  | 'music'
  | 'credit_card'
  | 'home';

export type ColorKey =
  | 'orange'
  | 'pink'
  | 'green'
  | 'blue'
  | 'red'
  | 'teal'
  | 'yellow'
  | 'indigo'
  | 'cyan'
  | 'amber'
  | 'violet'
  | 'gray'
  | 'purple';

export const ICON_OPTIONS: Record<IconKey, { label: string; Icon: LucideIcon }> = {
  utensils: { label: 'Utensils', Icon: Utensils },
  shopping_bag: { label: 'Shopping bag', Icon: ShoppingBag },
  shopping_cart: { label: 'Shopping cart', Icon: ShoppingCart },
  car: { label: 'Car', Icon: Car },
  receipt: { label: 'Receipt', Icon: Receipt },
  gamepad: { label: 'Gamepad', Icon: Gamepad2 },
  stethoscope: { label: 'Stethoscope', Icon: Stethoscope },
  graduation_cap: { label: 'Graduation cap', Icon: GraduationCap },
  plane: { label: 'Plane', Icon: Plane },
  hotel: { label: 'Hotel', Icon: Hotel },
  coffee: { label: 'Coffee', Icon: Coffee },
  music: { label: 'Music', Icon: Music },
  credit_card: { label: 'Credit card', Icon: CreditCard },
  home: { label: 'Home', Icon: Home },
};

export const COLOR_OPTIONS: Record<
  ColorKey,
  { label: string; badgeClass: string; chartFillHex: string }
> = {
  orange: { label: 'Orange', badgeClass: 'bg-orange-100 text-orange-700', chartFillHex: '#f97316' },
  pink: { label: 'Pink', badgeClass: 'bg-pink-100 text-pink-700', chartFillHex: '#ec4899' },
  green: { label: 'Green', badgeClass: 'bg-green-100 text-green-700', chartFillHex: '#22c55e' },
  blue: { label: 'Blue', badgeClass: 'bg-blue-100 text-blue-700', chartFillHex: '#3b82f6' },
  red: { label: 'Red', badgeClass: 'bg-red-100 text-red-700', chartFillHex: '#ef4444' },
  teal: { label: 'Teal', badgeClass: 'bg-teal-100 text-teal-700', chartFillHex: '#14b8a6' },
  yellow: { label: 'Yellow', badgeClass: 'bg-yellow-100 text-yellow-700', chartFillHex: '#eab308' },
  indigo: { label: 'Indigo', badgeClass: 'bg-indigo-100 text-indigo-700', chartFillHex: '#6366f1' },
  cyan: { label: 'Cyan', badgeClass: 'bg-cyan-100 text-cyan-700', chartFillHex: '#06b6d4' },
  amber: { label: 'Amber', badgeClass: 'bg-amber-100 text-amber-700', chartFillHex: '#f59e0b' },
  violet: { label: 'Violet', badgeClass: 'bg-violet-100 text-violet-700', chartFillHex: '#8b5cf6' },
  gray: { label: 'Gray', badgeClass: 'bg-gray-100 text-gray-700', chartFillHex: '#6b7280' },
  purple: { label: 'Purple', badgeClass: 'bg-purple-100 text-purple-700', chartFillHex: '#9333ea' },
};

export const DEFAULT_CATEGORIES: CategoryConfig[] = [
  { name: 'Food', icon_key: 'utensils', color_key: 'orange' },
  { name: 'Shopping', icon_key: 'shopping_bag', color_key: 'pink' },
  { name: 'Groceries', icon_key: 'shopping_cart', color_key: 'green' },
  { name: 'Transport', icon_key: 'car', color_key: 'blue' },
  { name: 'Bills', icon_key: 'receipt', color_key: 'red' },
  { name: 'Entertainment', icon_key: 'gamepad', color_key: 'pink' },
  { name: 'Healthcare', icon_key: 'stethoscope', color_key: 'teal' },
  { name: 'Education', icon_key: 'graduation_cap', color_key: 'yellow' },
  { name: 'Travel', icon_key: 'plane', color_key: 'indigo' },
  { name: 'Coffee', icon_key: 'coffee', color_key: 'amber' },
  { name: 'Subscriptions', icon_key: 'receipt', color_key: 'violet' },
  { name: 'Installments', icon_key: 'receipt', color_key: 'blue' },
  { name: 'Other', icon_key: 'credit_card', color_key: 'gray' },
];

export function findCategoryConfig(
  categoryName: string,
  categories?: CategoryConfig[] | null
): CategoryConfig | null {
  const list = categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES;
  const normalized = categoryName.trim().toLowerCase();
  const hit = list.find((c) => c.name.trim().toLowerCase() === normalized);
  if (hit) return hit;
  // Unknown category fallback
  return list.find((c) => c.name.trim().toLowerCase() === 'other') ?? null;
}

export function getCategoryBadgeClass(
  categoryName: string,
  categories?: CategoryConfig[] | null
): string {
  const cfg = findCategoryConfig(categoryName, categories);
  const colorKey = String(cfg?.color_key ?? 'gray').trim().toLowerCase();

  // Backward compatibility: if DB stores full Tailwind classes, infer the color key
  // and return a static class from COLOR_OPTIONS (safer with Tailwind builds).
  if (colorKey.includes('bg-') && colorKey.includes('text-')) {
    const m = colorKey.match(/bg-([a-z]+)-\d+/i);
    const inferred = m?.[1]?.toLowerCase() as ColorKey | undefined;
    if (inferred && COLOR_OPTIONS[inferred]) {
      return COLOR_OPTIONS[inferred].badgeClass;
    }
    return COLOR_OPTIONS.gray.badgeClass;
  }

  return COLOR_OPTIONS[colorKey as ColorKey]?.badgeClass ?? COLOR_OPTIONS.gray.badgeClass;
}

export function getCategoryChartFill(
  categoryName: string,
  categories?: CategoryConfig[] | null
): string {
  const cfg = findCategoryConfig(categoryName, categories);
  const colorKey = String(cfg?.color_key ?? 'gray').trim().toLowerCase();

  // Backward compatibility: infer key from Tailwind class text if needed.
  if (colorKey.includes('bg-') && colorKey.includes('text-')) {
    const m = colorKey.match(/bg-([a-z]+)-\d+/i);
    const inferred = m?.[1]?.toLowerCase() as ColorKey | undefined;
    if (inferred && COLOR_OPTIONS[inferred]) {
      return COLOR_OPTIONS[inferred].chartFillHex;
    }
    return COLOR_OPTIONS.gray.chartFillHex;
  }

  return COLOR_OPTIONS[colorKey as ColorKey]?.chartFillHex ?? COLOR_OPTIONS.gray.chartFillHex;
}

export function getCategoryIconNode(
  categoryName: string,
  categories?: CategoryConfig[] | null,
  className = 'w-5 h-5'
): React.ReactNode {
  const cfg = findCategoryConfig(categoryName, categories);
  const iconKey = cfg?.icon_key ?? 'credit_card';
  const Icon = ICON_OPTIONS[iconKey]?.Icon ?? CreditCard;
  return React.createElement(Icon, { className });
}

