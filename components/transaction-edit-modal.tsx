'use client';

import { useState, useEffect } from 'react';
import { Transaction } from '@/lib/data';
import { updateTransactionCategory } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { X, Plus, ShoppingCart, ShoppingBag, Fuel, Utensils, Car, Home, CreditCard, Receipt, Heart, Gamepad2, GraduationCap, Stethoscope, Music, Coffee, Plane, Hotel } from 'lucide-react';

interface CategoryOption {
  name: string;
  icon: React.ReactNode;
  color: string;
}

const defaultCategories: CategoryOption[] = [
  { name: 'Food', icon: <Utensils className="w-5 h-5" />, color: 'bg-orange-100 text-orange-700' },
  { name: 'Groceries', icon: <ShoppingCart className="w-5 h-5" />, color: 'bg-green-100 text-green-700' },
  { name: 'Shopping', icon: <ShoppingBag className="w-5 h-5" />, color: 'bg-purple-100 text-purple-700' },
  { name: 'Transport', icon: <Car className="w-5 h-5" />, color: 'bg-blue-100 text-blue-700' },
  { name: 'Bills', icon: <Receipt className="w-5 h-5" />, color: 'bg-red-100 text-red-700' },
  { name: 'Entertainment', icon: <Gamepad2 className="w-5 h-5" />, color: 'bg-pink-100 text-pink-700' },
  { name: 'Healthcare', icon: <Stethoscope className="w-5 h-5" />, color: 'bg-teal-100 text-teal-700' },
  { name: 'Education', icon: <GraduationCap className="w-5 h-5" />, color: 'bg-yellow-100 text-yellow-700' },
  { name: 'Travel', icon: <Plane className="w-5 h-5" />, color: 'bg-indigo-100 text-indigo-700' },
  { name: 'Accommodation', icon: <Hotel className="w-5 h-5" />, color: 'bg-cyan-100 text-cyan-700' },
  { name: 'Coffee', icon: <Coffee className="w-5 h-5" />, color: 'bg-amber-100 text-amber-700' },
  { name: 'Music', icon: <Music className="w-5 h-5" />, color: 'bg-violet-100 text-violet-700' },
  { name: 'Other', icon: <CreditCard className="w-5 h-5" />, color: 'bg-gray-100 text-gray-700' },
];

const iconOptions = [
  { name: 'ShoppingCart', icon: <ShoppingCart className="w-5 h-5" /> },
  { name: 'ShoppingBag', icon: <ShoppingBag className="w-5 h-5" /> },
  { name: 'Fuel', icon: <Fuel className="w-5 h-5" /> },
  { name: 'Utensils', icon: <Utensils className="w-5 h-5" /> },
  { name: 'Car', icon: <Car className="w-5 h-5" /> },
  { name: 'Home', icon: <Home className="w-5 h-5" /> },
  { name: 'CreditCard', icon: <CreditCard className="w-5 h-5" /> },
  { name: 'Receipt', icon: <Receipt className="w-5 h-5" /> },
  { name: 'Heart', icon: <Heart className="w-5 h-5" /> },
  { name: 'Gamepad2', icon: <Gamepad2 className="w-5 h-5" /> },
  { name: 'GraduationCap', icon: <GraduationCap className="w-5 h-5" /> },
  { name: 'Stethoscope', icon: <Stethoscope className="w-5 h-5" /> },
  { name: 'Music', icon: <Music className="w-5 h-5" /> },
  { name: 'Coffee', icon: <Coffee className="w-5 h-5" /> },
  { name: 'Plane', icon: <Plane className="w-5 h-5" /> },
  { name: 'Hotel', icon: <Hotel className="w-5 h-5" /> },
];

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
  const [categories, setCategories] = useState<CategoryOption[]>(defaultCategories);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<React.ReactNode>(<CreditCard className="w-5 h-5" />);
  const [selectedColor, setSelectedColor] = useState('bg-gray-100 text-gray-700');
  const [showIconPicker, setShowIconPicker] = useState(false);

  const colorOptions = [
    'bg-orange-100 text-orange-700',
    'bg-green-100 text-green-700',
    'bg-purple-100 text-purple-700',
    'bg-blue-100 text-blue-700',
    'bg-red-100 text-red-700',
    'bg-pink-100 text-pink-700',
    'bg-teal-100 text-teal-700',
    'bg-yellow-100 text-yellow-700',
    'bg-indigo-100 text-indigo-700',
    'bg-cyan-100 text-cyan-700',
    'bg-amber-100 text-amber-700',
    'bg-violet-100 text-violet-700',
    'bg-gray-100 text-gray-700',
  ];

  useEffect(() => {
    if (transaction) {
      setSelectedCategory(transaction.category);
      setIsAddingNew(false);
      setNewCategoryName('');
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const handleSave = async () => {
    if (isAddingNew && newCategoryName.trim()) {
      // Add new category to list
      const newCategory: CategoryOption = {
        name: newCategoryName.trim(),
        icon: selectedIcon,
        color: selectedColor,
      };
      setCategories([...categories, newCategory]);
      setSelectedCategory(newCategoryName.trim());
      setIsAddingNew(false);
    }

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

  const handleAddNewCategory = () => {
    setIsAddingNew(true);
    setSelectedCategory(''); // Clear selected category
    setNewCategoryName('');
    setSelectedIcon(<CreditCard className="w-5 h-5" />);
    setSelectedColor('bg-gray-100 text-gray-700');
    setShowIconPicker(false);
    
    // Scroll to form after a brief delay to ensure it's rendered
    setTimeout(() => {
      const formElement = document.getElementById('new-category-form');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
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
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transaction Info */}
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              {categories.find(c => c.name === transaction.category)?.icon || <CreditCard className="w-5 h-5" />}
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
            {categories.map((category) => (
              <button
                key={category.name}
                onClick={() => {
                  setSelectedCategory(category.name);
                  setIsAddingNew(false);
                }}
                className={`p-3 rounded-xl border-2 transition-all ${
                  selectedCategory === category.name && !isAddingNew
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-200 bg-white hover:border-purple-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-full ${category.color} flex items-center justify-center mx-auto mb-2`}>
                  {category.icon}
                </div>
                <p className={`text-xs font-medium ${
                  selectedCategory === category.name && !isAddingNew
                    ? 'text-purple-600'
                    : 'text-gray-700'
                }`}>
                  {category.name}
                </p>
              </button>
            ))}
          </div>

          {/* Add New Category Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleAddNewCategory();
            }}
            className="w-full p-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all flex items-center justify-center gap-2 active:scale-95"
            type="button"
          >
            <Plus className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Add New Category</span>
          </button>

          {/* New Category Form */}
          {isAddingNew && (
            <div id="new-category-form" className="mt-4 p-4 bg-purple-50 rounded-xl space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Category Name
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Enter category name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Icon
                </label>
                <button
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="w-full p-3 bg-white border border-gray-300 rounded-lg flex items-center justify-center"
                  aria-label="Select icon"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                    {selectedIcon}
                  </div>
                </button>
                {showIconPicker && (
                  <div className="mt-2 grid grid-cols-4 gap-2 p-2 bg-white border border-gray-200 rounded-lg">
                    {iconOptions.map((iconOption, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setSelectedIcon(iconOption.icon);
                          setShowIconPicker(false);
                        }}
                        className="p-2 hover:bg-purple-50 rounded-lg transition-colors"
                        aria-label={`Select ${iconOption.name} icon`}
                      >
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                          {iconOption.icon}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Color
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {colorOptions.map((color, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedColor(color)}
                      className={`h-10 rounded-lg border-2 ${
                        selectedColor === color
                          ? 'border-purple-600 ring-2 ring-purple-200'
                          : 'border-gray-200'
                      } ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
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
            disabled={!selectedCategory || (isAddingNew && !newCategoryName.trim())}
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
