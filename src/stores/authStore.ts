import { create } from 'zustand'
import { authApi } from '../api/auth'
import { onSessionRefreshed, refreshSession } from '../api/client'
import { clearTokens, getRefreshToken, setAccessToken, setRefreshToken } from '../api/tokens'
import type { MeResponse, VisibleShop } from '../api/types'
import { resolveCurrentShop } from '../shop/visibility'
import { useShopStore } from './shopStore'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthState {
  status: AuthStatus
  me: MeResponse | null
  permissions: string[]
  shops: VisibleShop[]
  defaultShopId: string | null
  login: (login: string, password: string) => Promise<void>
  bootstrap: () => Promise<void>
  loadContext: () => Promise<void>
  logout: () => Promise<void>
}

const empty = {
  me: null,
  permissions: [] as string[],
  shops: [] as VisibleShop[],
  defaultShopId: null as string | null,
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  ...empty,

  login: async (login, password) => {
    const response = await authApi.login({ login, password })
    setAccessToken(response.data.access_token)
    setRefreshToken(response.data.refresh_token)
    await get().loadContext()
  },

  bootstrap: async () => {
    if (!getRefreshToken()) {
      set({ status: 'anonymous', ...empty })
      return
    }
    try {
      // The refresh listener loads /me, /me/shops and /me/permissions.
      await refreshSession()
    } catch {
      clearTokens()
      set({ status: 'anonymous', ...empty })
    }
  },

  loadContext: async () => {
    const [me, shops, permissions] = await Promise.all([
      authApi.me(),
      authApi.myShops(),
      authApi.permissions(),
    ])
    const visible = shops.data.shops
    const current = resolveCurrentShop(
      visible,
      shops.data.default_shop_id,
      useShopStore.getState().currentShopId,
    )
    useShopStore.getState().setCurrent(current)
    set({
      status: 'authenticated',
      me: me.data,
      shops: visible,
      defaultShopId: shops.data.default_shop_id,
      permissions: permissions.data.permissions,
    })
  },

  logout: async () => {
    const token = getRefreshToken()
    try {
      if (token) await authApi.logout(token)
    } finally {
      clearTokens()
      useShopStore.getState().setCurrent(null)
      set({ status: 'anonymous', ...empty })
    }
  },
}))

onSessionRefreshed(() => {
  void useAuthStore.getState().loadContext().catch(() => {
    clearTokens()
    useAuthStore.setState({ status: 'anonymous', ...empty })
  })
})

export function hasPermission(permissions: string[], code: string): boolean {
  return permissions.includes(code)
}
