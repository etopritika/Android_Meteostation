import { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getBluetoothDebugLog, subscribeBluetoothDebugLog } from '@/bluetooth/debug';
import { useBluetoothConnection } from '@/bluetooth/bluetooth-connection';
import { bluetoothResponses } from '@/bluetooth/protocol';
import { ActionButton } from '@/components/action-button';
import { strings } from '@/constants/strings';
import { palette } from '@/theme/palette';
import { tokens } from '@/theme/tokens';

export function DebugControls() {
  const { phase, autoStream, commandError, serviceBusy, awaitingServiceAck, sendServiceCommand } = useBluetoothConnection();
  const entries = useSyncExternalStore(subscribeBluetoothDebugLog, getBluetoothDebugLog, getBluetoothDebugLog);
  const connected = phase === 'connected';
  const startDisabled = !connected || serviceBusy || autoStream === 'on';
  const stopDisabled = !connected || serviceBusy || autoStream === 'off';
  const getDataDisabled = !connected || serviceBusy;
  const streamLabel = autoStream === 'on' ? bluetoothResponses.autoOn : autoStream === 'off' ? bluetoothResponses.autoOff : strings.debug.unknownStream;

  let tx = 0;
  let rx = 0;
  let errors = 0;
  for (const entry of entries) {
    if (entry.category === 'TX') {
      tx += 1;
    } else if (entry.category === 'RX') {
      rx += 1;
    } else if (entry.category === 'ERR') {
      errors += 1;
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.title}>{strings.debug.streamTitle}</Text>
        <Text style={[styles.status, autoStream === 'on' ? styles.statusOn : null]}>{streamLabel}</Text>
        <View style={styles.commandRow}>
          <View style={styles.commandSlot}>
            <ActionButton label={strings.debug.start} disabled={startDisabled} onPress={() => void sendServiceCommand('start')} />
          </View>
          <View style={styles.commandSlot}>
            <ActionButton
              label={strings.debug.stop}
              variant="secondary"
              disabled={stopDisabled}
              onPress={() => void sendServiceCommand('stop')}
            />
          </View>
        </View>
        <ActionButton
          label={strings.debug.getData}
          variant="secondary"
          disabled={getDataDisabled}
          onPress={() => void sendServiceCommand('getData')}
        />
        <Text style={styles.hint}>{strings.debug.startHint}</Text>
        <Text style={styles.hint}>{strings.debug.stopHint}</Text>
        <Text style={styles.hint}>{strings.debug.getDataHint}</Text>
        {awaitingServiceAck ? <Text style={styles.hint}>{strings.debug.awaitingConfirmation}</Text> : null}
        {commandError ? <Text style={styles.error}>{commandError}</Text> : null}
      </View>

      <View style={styles.stats}>
        <Stat label={strings.debug.category.TX} value={tx} color={palette.accent} />
        <Stat label={strings.debug.category.RX} value={rx} color={palette.logRx} />
        <Stat label={strings.debug.statsErrors} value={errors} color={palette.error} />
      </View>
      <Text style={styles.statsHint}>{strings.debug.statsHint}</Text>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: tokens.space.md,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.control,
    gap: tokens.space.sm,
  },
  title: {
    color: palette.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  status: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  statusOn: {
    color: palette.logRx,
  },
  commandRow: {
    flexDirection: 'row',
    gap: tokens.space.sm,
  },
  commandSlot: {
    flex: 1,
  },
  hint: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    color: palette.error,
    fontSize: 14,
    lineHeight: 20,
  },
  stats: {
    flexDirection: 'row',
    gap: tokens.space.sm,
  },
  stat: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingVertical: tokens.space.sm,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
  statLabel: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  statsHint: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
});
