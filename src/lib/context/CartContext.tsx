'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { CartItem, Product } from '@/lib/types'

interface CartContextType {
  items: CartItem[]
  addItem: (product: Product, quantity: number, notes?: string, orderMode?: 'by_quantity' | 'by_budget', budgetAmount?: number) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  updateNotes: (productId: string, notes: string) => void
  updateBudget: (productId: string, budgetAmount: number) => void
  setItemOrderMode: (productId: string, mode: 'by_quantity' | 'by_budget', budgetAmount?: number) => void
  clearCart: () => void
  totalItems: number
  totalPrice: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  // Load cart from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sayurku_cart')
    if (saved) {
      try {
        setItems(JSON.parse(saved))
      } catch {}
    }
  }, [])

  // Save cart to localStorage on change
  useEffect(() => {
    localStorage.setItem('sayurku_cart', JSON.stringify(items))
  }, [items])

  const addItem = (
    product: Product,
    quantity: number,
    notes?: string,
    orderMode: 'by_quantity' | 'by_budget' = 'by_quantity',
    budgetAmount?: number
  ) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        // If same product already in cart, just update quantity (keep existing mode)
        return prev.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.orderMode === 'by_budget' ? item.quantity : item.quantity + quantity,
                notes: notes || item.notes,
              }
            : item
        )
      }
      return [...prev, { product, quantity, notes, orderMode, budgetAmount }]
    })
  }

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId))
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId)
      return
    }
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    )
  }

  const updateNotes = (productId: string, notes: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, notes } : item
      )
    )
  }

  const updateBudget = (productId: string, budgetAmount: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, budgetAmount, orderMode: 'by_budget' }
          : item
      )
    )
  }

  const setItemOrderMode = (
    productId: string,
    mode: 'by_quantity' | 'by_budget',
    budgetAmount?: number
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              orderMode: mode,
              budgetAmount: mode === 'by_budget' ? (budgetAmount ?? item.budgetAmount ?? 5000) : undefined,
              quantity: mode === 'by_budget' ? 1 : item.quantity,
            }
          : item
      )
    )
  }

  const clearCart = () => setItems([])

  // totalItems: count all items in cart
  const totalItems = items.length

  // totalPrice: for by_budget items use budgetAmount, for by_quantity use qty × price_per_unit
  const totalPrice = items.reduce((sum, item) => {
    if (item.orderMode === 'by_budget') {
      return sum + (item.budgetAmount ?? 0)
    }
    return sum + item.product.price_per_unit * item.quantity
  }, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        updateNotes,
        updateBudget,
        setItemOrderMode,
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within CartProvider')
  return context
}
