import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { colors, radius } from "../theme";

/** Two coffee cherries, drawn with plain views so no extra native module is needed. */
export function Logo({ size = 44 }: { size?: number }) {
  const big = size * 0.62;
  const small = size * 0.55;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: size * 0.38,
          width: size * 0.3,
          height: size * 0.16,
          borderRadius: size,
          backgroundColor: "#5fae82",
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: big,
          height: big,
          borderRadius: big,
          backgroundColor: "#d0493a",
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: small,
          height: small,
          borderRadius: small,
          backgroundColor: colors.cherry,
        }}
      />
    </View>
  );
}

export function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: colors.primaryTint,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.primaryDark, fontWeight: "700", fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

type Variant = "primary" | "secondary" | "danger" | "ghost";

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const palette = {
    primary: { bg: colors.primary, fg: "white", border: colors.primary },
    secondary: { bg: "white", fg: colors.primaryDark, border: colors.border },
    danger: { bg: colors.cherry, fg: "white", border: colors.cherry },
    ghost: { bg: "transparent", fg: colors.primary, border: "transparent" },
  }[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={{
        backgroundColor: palette.bg,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: radius.sm,
        paddingVertical: 14,
        paddingHorizontal: 18,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={{ color: palette.fg, fontWeight: "700", fontSize: 15 }}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function Pill({ text, tone = "green" }: { text: string; tone?: "green" | "gold" | "red" | "grey" }) {
  const t = {
    green: { bg: colors.primaryTint, fg: colors.primaryDark },
    gold: { bg: colors.goldTint, fg: colors.gold },
    red: { bg: colors.cherryTint, fg: colors.cherry },
    grey: { bg: "#efeae1", fg: colors.muted },
  }[tone];
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" }}>
      <Text style={{ color: t.fg, fontSize: 11, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

/** Branded full-screen frame for the sign-in screens: green header, form on a rounded sheet. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.primaryDeep }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 28, paddingTop: 80, paddingBottom: 36 }}>
          <Logo size={52} />
          <Text style={{ color: "white", fontSize: 30, fontWeight: "800", marginTop: 20 }}>{title}</Text>
          {subtitle ? <Text style={{ color: "#cfe0d5", marginTop: 6, fontSize: 15 }}>{subtitle}</Text> : null}
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.bg,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            padding: 24,
            paddingTop: 28,
          }}
        >
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
