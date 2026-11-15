import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { useBluetoothConnection } from '@/bluetooth/bluetooth-connection';
import { ActionButton } from '@/components/action-button';
import { MetricCard } from '@/components/metric-card';
import { ScreenContainer, ScreenTitle } from '@/components/screen-container';
import { strings } from '@/constants/strings';
import { useDebugCombo, useDebugUnlocked } from '@/hooks/use-debug-unlock';
import { palette } from '@/theme/palette';
import { tokens } from '@/theme/tokens';

export default function StationScreen() {
  const { phase, error, ledError, temperature, humidity, ledState, ledLoading, disconnect, changeLed } = useBluetoothConnection();
  const connected = phase === 'connected';
  const disconnecting = phase === 'disconnecting';
  const temperatureText = temperature === null ? strings.station.emptyValue : temperature.toFixed(1);
  const humidityText = humidity === null ? strings.station.emptyValue : String(humidity);
  const ledHint = ledState === null ? strings.station.ledUnknown : ledState ? strings.station.ledOn : strings.station.ledOff;
  const ledDisabled = !connected || ledLoading;
  const debugUnlocked = useDebugUnlocked();
  const { registerTitleTap } = useDebugCombo();

  useFocusEffect(
    useCallback(() => {
      if (connected || disconnecting) {
        return;
      }

      router.replace('/');
    }, [connected, disconnecting]),
  );

  return (
    <ScreenContainer>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ScreenTitle onPress={registerTitleTap} />

        <View style={styles.connection} accessibilityRole="text">
          <View style={[styles.indicator, connected ? styles.indicatorLive : null]} />
          <Text style={styles.connectionText}>{connected ? strings.bluetooth.connected : strings.bluetooth.disconnected}</Text>
        </View>

        <View style={styles.metrics}>
          <MetricCard
            label={strings.station.temperature}
            value={temperatureText}
            unit={strings.station.celsius}
            hint={temperature === null ? strings.station.noData : strings.station.fromModule}
          />
          <MetricCard
            label={strings.station.humidity}
            value={humidityText}
            unit={strings.station.percent}
            hint={humidity === null ? strings.station.noData : strings.station.fromModule}
          />
        </View>

        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={strings.station.led}
          accessibilityState={{ disabled: ledDisabled, checked: ledState === true }}
          disabled={ledDisabled}
          onPress={() => {
            void changeLed(ledState === null ? true : !ledState);
          }}
          style={({ pressed }) => [styles.ledCard, pressed && !ledDisabled && styles.ledCardPressed]}>
          <View style={styles.ledCopy}>
            <Text style={styles.ledTitle}>{strings.station.led}</Text>
            <Text style={styles.ledHint}>{ledHint}</Text>
          </View>
          <Switch
            importantForAccessibility="no"
            accessibilityElementsHidden
            value={ledState === true}
            disabled={ledDisabled}
            onValueChange={(next) => {
              void changeLed(next);
            }}
            trackColor={{ false: palette.switchTrackOff, true: palette.accent }}
            thumbColor={ledState ? palette.text : palette.textMuted}
          />
        </Pressable>
        {ledError ? <Text style={styles.ledError}>{ledError}</Text> : null}

        <View style={styles.footer}>
          <ActionButton
            label={strings.station.disconnect}
            variant="secondary"
            disabled={disconnecting}
            onPress={() => void disconnect()}
          />
          {error && connected ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </ScrollView>
      {debugUnlocked ? (
        <View style={styles.debugAction}>
          <ActionButton label={strings.debug.open} variant="secondary" onPress={() => router.push('/debug')} />
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  connection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.textMuted,
  },
  indicatorLive: {
    backgroundColor: palette.accent,
  },
  connectionText: {
    color: palette.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  metrics: {
    flexDirection: 'row',
    gap: tokens.space.sm,
    marginTop: tokens.space.lg,
  },
  ledCard: {
    marginTop: tokens.space.sm,
    backgroundColor: palette.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.sm,
  },
  ledCardPressed: {
    opacity: tokens.opacity.pressed,
  },
  ledCopy: {
    flex: 1,
    gap: 4,
  },
  ledTitle: {
    color: palette.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  ledHint: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  ledError: {
    marginTop: tokens.space.sm,
    color: palette.error,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: tokens.space.lg,
    gap: tokens.space.sm,
  },
  debugAction: {
    marginTop: tokens.space.md,
  },
  errorText: {
    color: palette.error,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
