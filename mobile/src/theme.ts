import { useColorScheme } from 'react-native'
import type { ThemeMode } from './types'

export const palette = {
  green950: '#13392f',
  green900: '#1d4d3f',
  green800: '#276854',
  green700: '#337f68',
  green100: '#dfeee8',
  green50: '#eef7f3',
  cream: '#f7f5ef',
  amber: '#d99a3d',
  amberSoft: '#faedcf',
  lilac: '#9277ad',
  lilacSoft: '#eee8f4',
  coral: '#c97b55',
  coralSoft: '#f7e7de',
  blue: '#557d9d',
  blueSoft: '#e5eef5',
  ink: '#18251f',
  muted: '#728079',
  line: '#dde5e0',
  white: '#ffffff',
  danger: '#b84b4b',
}

export interface AppTheme {
  dark: boolean
  background: string
  surface: string
  surfaceAlt: string
  text: string
  muted: string
  line: string
  primary: string
  primarySoft: string
  tabBar: string
}

export function useAppTheme(mode: ThemeMode): AppTheme {
  const system = useColorScheme()
  const dark = mode === 'dark' || (mode === 'system' && system === 'dark')
  return dark ? {
    dark,
    background: '#101a16',
    surface: '#17251f',
    surfaceAlt: '#1d3028',
    text: '#f3f7f5',
    muted: '#9cafa6',
    line: '#2c4339',
    primary: '#75b9a0',
    primarySoft: '#203d32',
    tabBar: '#14211c',
  } : {
    dark,
    background: palette.cream,
    surface: palette.white,
    surfaceAlt: '#f5f7f5',
    text: palette.ink,
    muted: palette.muted,
    line: palette.line,
    primary: palette.green700,
    primarySoft: palette.green50,
    tabBar: palette.white,
  }
}
