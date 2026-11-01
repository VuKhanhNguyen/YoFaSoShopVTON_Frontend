/**
 * YoFaSo Shop — Master Semantic Design System Tokens (DESIGN.md)
 * Warm Editorial Minimalism & Tactical Frosted Glass
 * Strict Purple Ban: Obsidian (#0F172A), Alabaster (#FAFAF9), Champagne Bronze (#C5A880)
 */

import { Platform } from "react-native";

export const Colors = {
  // Core Palettes
  canvas: "#FAFAF9",
  surface: "#FFFFFF",
  surfaceMuted: "#F4F4F5",
  primary: "#0F172A",
  primaryHover: "#1E293B",
  
  // Champagne Bronze Accent
  champagne: "#C5A880",
  champagneDeep: "#9A7B4F",
  champagneSubtle: "#FBF8F3",
  accent: "#C5A880",
  accentHover: "#9A7B4F",
  accentSubtle: "#FBF8F3",

  // Borders & Dividers
  borderHairline: "#E2E8F0",
  borderGlass: "rgba(15, 23, 42, 0.06)",
  hairline: "#E2E8F0",

  // Text Hierarchy
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  textFaint: "#CBD5E1",
  muted: "#64748B",

  // Functional & Scoring States
  statusSuccess: "#059669",
  statusSuccessSubtle: "#ECFDF5",
  statusInfo: "#0284C7",
  statusInfoSubtle: "#F0F9FF",
  statusWarning: "#D97706",
  statusWarningSubtle: "#FFFBEB",
  statusDanger: "#DC2626",
  statusDangerSubtle: "#FEF2F2",

  // Glass Dock
  glassDockBg: "rgba(255, 255, 255, 0.88)",
  glassDockBorder: "rgba(255, 255, 255, 0.65)",

  // Light/Dark mapping compatibility
  light: {
    text: "#0F172A",
    background: "#FAFAF9",
    backgroundElement: "#F4F4F5",
    backgroundSelected: "#FBF8F3",
    textSecondary: "#475569",
  },
  dark: {
    text: "#FFFFFF",
    background: "#0F172A",
    backgroundElement: "#1E293B",
    backgroundSelected: "#334155",
    textSecondary: "#94A3B8",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

export const Fonts = {
  editorial: "Editorial", // Playfair-SemiBold.ttf
  sans: "Jakarta", // Jakarta-Regular.ttf
  sansSemiBold: "JakartaSemiBold", // Jakarta-SemiBold.ttf
  mono: "Mono", // JetBrains-Medium.ttf
};

export const Radii = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const MaxContentWidth = 600;

export const Shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    default: {
      elevation: 2,
      shadowColor: "#0F172A",
    },
  }),
  md: Platform.select({
    ios: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    default: {
      elevation: 4,
      shadowColor: "#0F172A",
    },
  }),
  lg: Platform.select({
    ios: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
    default: {
      elevation: 8,
      shadowColor: "#0F172A",
    },
  }),
  dock: Platform.select({
    ios: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
    },
    default: {
      elevation: 8,
      shadowColor: "#0F172A",
    },
  }),
  sheet: Platform.select({
    ios: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: -12 },
      shadowOpacity: 0.16,
      shadowRadius: 32,
    },
    default: {
      elevation: 16,
      shadowColor: "#0F172A",
    },
  }),
  toast: Platform.select({
    ios: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
    },
    default: {
      elevation: 10,
      shadowColor: "#0F172A",
    },
  }),
  glow: Platform.select({
    ios: {
      shadowColor: "#C5A880",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
    },
    default: {
      elevation: 6,
      shadowColor: "#C5A880",
    },
  }),
};
