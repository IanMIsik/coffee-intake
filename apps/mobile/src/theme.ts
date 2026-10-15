// One place for the look of the app. Screens should prefer these over raw hex values.
export const colors = {
  bg: "#f6f2ea",
  surface: "#ffffff",
  border: "#e8e0d3",
  ink: "#1f1b16",
  muted: "#7b7266",
  primary: "#2b6a4b",
  primaryDark: "#1d4d36",
  primaryDeep: "#143726",
  primaryTint: "#e4eee7",
  cherry: "#b73a2c",
  cherryTint: "#fdf0ee",
  gold: "#8a6414",
  goldTint: "#f8ecc9",
};

export const radius = { sm: 12, md: 16, lg: 22, pill: 999 };

export const shadow = {
  shadowColor: "#1f1b16",
  shadowOpacity: 0.07,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

export const card = {
  backgroundColor: colors.surface,
  borderRadius: radius.md,
  padding: 16,
  borderWidth: 1,
  borderColor: colors.border,
  ...shadow,
} as const;

export const input = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.sm,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 15,
  color: colors.ink,
} as const;
