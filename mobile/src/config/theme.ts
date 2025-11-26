/**
 * NeoPOP Design System Theme
 * Inspired by CRED's NeoPOP design language
 * https://cred.club/design
 * 
 * Key principles:
 * - Bold, clean aesthetics
 * - 3D skeuomorphic buttons with depth
 * - High contrast, accessible colors
 * - Premium, delightful feel
 */

// ============================================
// COLOR PALETTE
// ============================================

export const colors = {
  // Primary Colors
  primary: '#2563EB',       // Electric Blue - main CTA
  primaryDark: '#1D4ED8',   // Darker blue for 3D depth
  primaryLight: '#3B82F6',  // Lighter blue for hover

  // Secondary Colors
  secondary: '#F59E0B',     // Amber/Gold - accent
  secondaryDark: '#D97706', // Darker amber
  success: '#10B981',       // Emerald green
  successDark: '#059669',   // Darker green
  error: '#EF4444',         // Red
  errorDark: '#DC2626',     // Darker red
  warning: '#F59E0B',       // Amber

  // Background Colors
  background: '#FAFAFA',    // Off-white main background
  backgroundAlt: '#F5F5F5', // Slightly darker alt
  surface: '#FFFFFF',       // Card/surface white
  surfaceElevated: '#FFFFFF',

  // Text Colors
  textPrimary: '#1A1A1A',   // Near black
  textSecondary: '#6B7280', // Gray 500
  textTertiary: '#9CA3AF',  // Gray 400
  textInverse: '#FFFFFF',   // White text

  // Border Colors
  border: '#E5E7EB',        // Light gray border
  borderDark: '#1A1A1A',    // Black border for NeoPOP effect
  borderMedium: '#D1D5DB',  // Medium gray

  // Category Colors (vibrant, saturated)
  food: '#EF4444',          // Red
  accommodation: '#8B5CF6', // Purple
  place: '#3B82F6',         // Blue
  shopping: '#EC4899',      // Pink
  activity: '#10B981',      // Green
  tip: '#F59E0B',           // Amber

  // Status Colors
  visited: '#10B981',
  saved: '#F59E0B',

  // Special
  overlay: 'rgba(0,0,0,0.5)',
  shadow: '#000000',
};

// ============================================
// CATEGORY THEME CONFIG
// ============================================

export const categoryColors: Record<string, { bg: string; text: string; accent: string }> = {
  food: { bg: '#FEF2F2', text: '#DC2626', accent: '#EF4444' },
  accommodation: { bg: '#F5F3FF', text: '#7C3AED', accent: '#8B5CF6' },
  place: { bg: '#EFF6FF', text: '#2563EB', accent: '#3B82F6' },
  shopping: { bg: '#FDF2F8', text: '#DB2777', accent: '#EC4899' },
  activity: { bg: '#ECFDF5', text: '#059669', accent: '#10B981' },
  tip: { bg: '#FFFBEB', text: '#D97706', accent: '#F59E0B' },
};

// ============================================
// TYPOGRAPHY
// ============================================

export const typography = {
  // Font weights
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    black: '900' as const,
  },

  // Font sizes
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 40,
  },

  // Line heights
  lineHeights: {
    tight: 1.1,
    normal: 1.4,
    relaxed: 1.6,
  },
};

// ============================================
// SPACING
// ============================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
};

// ============================================
// BORDER RADIUS
// ============================================

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
};

// ============================================
// SHADOWS (NeoPOP 3D Effect)
// ============================================

export const shadows = {
  // NeoPOP style - hard edge shadows
  neopop: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 6, height: 6 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 6,
    },
  },

  // Soft shadows for elevated surfaces
  soft: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
      elevation: 8,
    },
  },
};

// ============================================
// COMPONENT STYLES
// ============================================

export const components = {
  // NeoPOP Button (Primary)
  buttonPrimary: {
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.borderDark,
    borderRadius: borderRadius.none,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    ...shadows.neopop.md,
  },

  // NeoPOP Button (Secondary/Outline)
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.borderDark,
    borderRadius: borderRadius.none,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    ...shadows.neopop.sm,
  },

  // Card (Elevated surface)
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.soft.md,
  },

  // NeoPOP Card (with hard edges)
  cardNeopop: {
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.borderDark,
    borderRadius: borderRadius.none,
    padding: spacing.lg,
    ...shadows.neopop.md,
  },

  // Input field
  input: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.borderDark,
    borderRadius: borderRadius.none,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.sizes.md,
    color: colors.textPrimary,
    ...shadows.neopop.sm,
  },

  // Tag/Pill
  tag: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
};

// ============================================
// NAVIGATION THEME
// ============================================

export const navigationTheme = {
  headerStyle: {
    backgroundColor: colors.background,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: {
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.lg,
    color: colors.textPrimary,
  },
};

// ============================================
// EXPORT THEME OBJECT
// ============================================

const theme = {
  colors,
  categoryColors,
  typography,
  spacing,
  borderRadius,
  shadows,
  components,
  navigationTheme,
};

export default theme;

