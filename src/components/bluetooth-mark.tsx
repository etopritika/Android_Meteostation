import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/constants/strings';
import { palette } from '@/theme/palette';

export function BluetoothMark() {
  return (
    <View style={styles.badge} accessibilityRole="image" accessibilityLabel={strings.bluetooth.markLabel}>
      <SymbolView
        name={{ android: 'bluetooth', web: 'bluetooth' }}
        tintColor={palette.accent}
        size={78}
        fallback={<Text style={styles.fallback}>{strings.bluetooth.markFallback}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 148,
    height: 148,
    borderRadius: 74,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.bluetoothBadge,
    borderWidth: 1,
    borderColor: palette.bluetoothBadgeBorder,
  },
  fallback: {
    color: palette.accent,
    fontSize: 36,
    fontWeight: '700',
  },
});
