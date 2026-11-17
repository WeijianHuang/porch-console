import type { ThemeConfig } from 'antd'

/**
 * Shared visual language for Porch Console.
 * Values mirror the CSS custom properties in styles.css so Ant Design
 * components and hand-built surfaces read as one product.
 */
export const palette = {
  forest: '#0e3327',
  forestSoft: '#174b38',
  primary: '#2f7d5b',
  primaryHover: '#25694b',
  mint: '#e8f3ec',
  canvas: '#f4f7f4',
  ink: '#16231d',
  inkSoft: '#5d7066',
  inkMuted: '#8a9a92',
  line: '#e1e9e3',
  amber: '#d99a4e',
  danger: '#c6544b',
} as const

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: palette.primary,
    colorInfo: palette.primary,
    colorSuccess: '#3f966e',
    colorWarning: palette.amber,
    colorError: palette.danger,
    colorText: palette.ink,
    colorTextSecondary: palette.inkSoft,
    colorTextTertiary: palette.inkMuted,
    colorBorder: palette.line,
    colorBorderSecondary: '#edf2ee',
    colorBgLayout: palette.canvas,
    colorBgContainer: '#ffffff',
    borderRadius: 10,
    borderRadiusLG: 14,
    borderRadiusSM: 6,
    fontSize: 14,
    controlHeight: 36,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
    boxShadowSecondary: '0 10px 30px rgba(14, 51, 39, 0.10)',
  },
  components: {
    Button: {
      fontWeight: 500,
      primaryShadow: '0 4px 12px rgba(47, 125, 91, 0.22)',
    },
    Menu: {
      itemHeight: 44,
      itemBorderRadius: 9,
      darkItemBg: 'transparent',
      darkItemColor: 'rgba(255, 255, 255, 0.66)',
      darkItemHoverColor: '#ffffff',
      darkItemSelectedBg: 'rgba(255, 255, 255, 0.13)',
      darkItemSelectedColor: '#ffffff',
    },
    Table: {
      headerBg: '#f7faf8',
      headerColor: palette.inkSoft,
      rowHoverBg: '#f7faf8',
      cellPaddingBlock: 14,
    },
    Select: {
      optionSelectedBg: palette.mint,
    },
    Input: {
      activeShadow: '0 0 0 3px rgba(47, 125, 91, 0.10)',
    },
    Modal: {
      titleFontSize: 18,
    },
  },
}
