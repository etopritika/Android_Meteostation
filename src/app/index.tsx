import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { BluetoothMark } from '@/components/bluetooth-mark';
import { ScreenContainer, ScreenTitle } from '@/components/screen-container';
import { strings } from '@/constants/strings';
import { useDebugCombo, useDebugUnlocked } from '@/hooks/use-debug-unlock';
import { palette } from '@/theme/palette';
import { tokens } from '@/theme/tokens';
import { useBluetoothConnection } from '@/bluetooth/bluetooth-connection';
import { useHc05Discovery } from '@/hooks/use-hc05-discovery';

export default function ConnectScreen() {
  const { status, statusLabel, detail, canConnect, target, searchAgain, stopDiscovery } = useHc05Discovery();
  const { phase, error, connect, clearError } = useBluetoothConnection();
  const connecting = phase === 'connecting' || phase === 'connected';
  const debugUnlocked = useDebugUnlocked();
  const { registerTitleTap } = useDebugCombo();

  useFocusEffect(
    useCallback(() => {
      if (phase === 'connected') {
        router.replace('/station');
      }
    }, [phase]),
  );

  const onConnect = async () => {
    if (!target || connecting) {
      return;
    }

    clearError();
    await stopDiscovery();
    await connect(target);
  };

  const onSearchAgain = () => {
    clearError();
    searchAgain();
  };

  const statusText = connecting ? strings.bluetooth.connecting : statusLabel;
  const detailText = connecting ? strings.bluetooth.connectingDetail : error ?? detail;
  const detailIsError = !connecting && (error !== null || status === 'error');

  return (
    <ScreenContainer>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ScreenTitle onPress={registerTitleTap} />

        <View style={styles.body}>
          <BluetoothMark />
          <Text style={styles.status}>{statusText}</Text>
          {detailText ? <Text style={[styles.detail, detailIsError ? styles.detailError : null]}>{detailText}</Text> : null}
        </View>

        <View style={styles.actions}>
          <ActionButton label={strings.bluetooth.connect} disabled={!canConnect || connecting} onPress={() => void onConnect()} />
          {status === 'notFound' && !connecting ? (
            <ActionButton label={strings.bluetooth.searchAgain} variant="secondary" onPress={onSearchAgain} />
          ) : null}
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
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.sm,
  },
  status: {
    color: palette.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  detail: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  detailError: {
    color: palette.error,
  },
  actions: {
    gap: tokens.space.sm,
  },
  debugAction: {
    marginTop: tokens.space.md,
  },
});
