import { create } from 'zustand'

/**
 * Card density for the dispatch board. Presentation only: it never leaves the
 * browser, never reaches the API and is never an authorization input.
 */
export type BoardDensity = 'compact' | 'medium' | 'loose'

export const BOARD_DENSITIES: BoardDensity[] = ['compact', 'medium', 'loose']

const KEY = 'porch-console:board-density'
const FALLBACK: BoardDensity = 'medium'

export function parseBoardDensity(raw: string | null | undefined): BoardDensity {
  return (BOARD_DENSITIES as string[]).includes(raw ?? '') ? (raw as BoardDensity) : FALLBACK
}

function readRemembered(): BoardDensity {
  try {
    return parseBoardDensity(localStorage.getItem(KEY))
  } catch {
    return FALLBACK
  }
}

interface BoardDensityState {
  boardDensity: BoardDensity
  setBoardDensity: (d: BoardDensity) => void
}

export const useBoardDensity = create<BoardDensityState>((set) => ({
  boardDensity: readRemembered(),
  setBoardDensity: (d) => {
    try {
      localStorage.setItem(KEY, d)
    } catch {
      // private mode: keep the value in memory only
    }
    set({ boardDensity: d })
  },
}))
