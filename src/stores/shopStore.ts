import { create } from 'zustand'

const REMEMBER_KEY = 'porch-console:current-shop'

function readRemembered(): string | null {
  try {
    return localStorage.getItem(REMEMBER_KEY)
  } catch {
    return null
  }
}

interface ShopState {
  /** Client-held request context; never an authorization source (ADR-0006). */
  currentShopId: string | null
  setCurrent: (id: string | null) => void
}

export const useShopStore = create<ShopState>((set) => ({
  currentShopId: readRemembered(),
  setCurrent: (id) => {
    try {
      if (id) localStorage.setItem(REMEMBER_KEY, id)
      else localStorage.removeItem(REMEMBER_KEY)
    } catch {
      // private mode: keep the value in memory only
    }
    set({ currentShopId: id })
  },
}))
