import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useBluetoothConnection } from '@/bluetooth/bluetooth-connection';
import type { BluetoothConnectionPhase } from '@/bluetooth/types';
import { strings } from '@/constants/strings';
import { palette } from '@/theme/palette';
import { tokens } from '@/theme/tokens';

const PHASE_LABEL: Record<BluetoothConnectionPhase, string> = {
  idle: strings.debug.phaseIdle,
  connecting: strings.debug.phaseConnecting,
  connected: strings.debug.phaseConnected,
  disconnecting: strings.debug.phaseDisconnecting,
  error: strings.debug.phaseError,
};

function formatReadingAge(updated: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - updated) / 1000));
  if (seconds < 1) {
    return strings.debug.justNow;
  }

  if (seconds < 60) {
    return strings.debug.secondsAgo(seconds);
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return strings.debug.minutesAgo(minutes);
  }

  return strings.debug.hoursAgo(Math.floor(minutes / 60));
}

export function ConnectionInfo() {
  const { device, phase, lastUpdated } = useBluetoothConnection();
  const [now, setNow] = useState(() => Date.now());
  const deviceName = device?.name?.trim() ? device.name.trim() : strings.station.emptyValue;

  useEffect(() => {
    if (lastUpdated === null) {
      return;
    }

    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{strings.debug.connectionTitle}</Text>
      <InfoRow label={strings.debug.deviceName} value={deviceName} />
      <InfoRow label={strings.debug.connectionPhase} value={PHASE_LABEL[phase]} />
      <InfoRow
        label={strings.debug.lastReading}
        value={lastUpdated === null ? strings.debug.noReading : formatReadingAge(lastUpdated, now)}
      />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.space.sm,
  },
  label: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  value: {
    flexShrink: 1,
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'right',
  },
});
