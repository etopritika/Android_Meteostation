import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/theme/palette';
import { tokens } from '@/theme/tokens';

type MetricCardProps = {
  label: string;
  value: string;
  unit: string;
  hint: string;
};

export function MetricCard({ label, value, unit, hint }: MetricCardProps) {
  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: tokens.space.md,
    gap: 8,
  },
  label: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  value: {
    color: palette.text,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '700',
  },
  unit: {
    color: palette.accent,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 4,
    fontWeight: '600',
  },
  hint: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
