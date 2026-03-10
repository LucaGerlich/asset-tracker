import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';

interface StatusBadgeProps {
  label: string;
  color?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const VARIANT_COLORS: Record<string, { bg: string; text: string }> = {
  default: { bg: '#e2e8f0', text: '#475569' },
  success: { bg: '#dcfce7', text: '#166534' },
  warning: { bg: '#fef9c3', text: '#854d0e' },
  danger: { bg: '#fee2e2', text: '#991b1b' },
  info: { bg: '#dbeafe', text: '#1e40af' },
};

export function StatusBadge({
  label,
  color,
  variant = 'default',
}: StatusBadgeProps) {
  const variantStyle = VARIANT_COLORS[variant] ?? VARIANT_COLORS.default;
  const bgColor = color || variantStyle.bg;

  return (
    <View style={[styles.badge, { backgroundColor: bgColor } as ViewStyle]}>
      <Text style={[styles.badgeText, { color: variantStyle.text } as TextStyle]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
