import { router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useBluetoothConnection } from '@/bluetooth/bluetooth-connection';
import { ActionButton } from '@/components/action-button';
import { ConnectionInfo } from '@/components/debug/connection-info';
import { DebugControls } from '@/components/debug/debug-controls';
import { DebugLogs } from '@/components/debug/debug-logs';
import { ScreenContainer, ScreenTitle } from '@/components/screen-container';
import { strings } from '@/constants/strings';
import { useDebugUnlocked } from '@/hooks/use-debug-unlock';
import { palette } from '@/theme/palette';
import { tokens } from '@/theme/tokens';

const TABS = ['controls', 'logs'] as const;

type DebugTab = (typeof TABS)[number];

const TAB_LABEL: Record<DebugTab, string> = {
  controls: strings.debug.tabControls,
  logs: strings.debug.tabLogs,
};

export default function DebugScreen() {
  const unlocked = useDebugUnlocked();
  const navigation = useNavigation();
  const { phase } = useBluetoothConnection();
  const connected = phase === 'connected' || phase === 'disconnecting';
  const [tab, setTab] = useState<DebugTab>('controls');
  const navigationState = navigation.getState();
  const previousRoute = navigationState && navigationState.index > 0 ? navigationState.routes[navigationState.index - 1]?.name : undefined;
  const backToStation = previousRoute === 'station' || (previousRoute === undefined && connected);

  useEffect(() => {
    if (unlocked) {
      return;
    }

    router.replace(connected ? '/station' : '/');
  }, [connected, unlocked]);

  if (!unlocked) {
    return null;
  }

  const onBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(connected ? '/station' : '/');
  };

  return (
    <ScreenContainer>
      <ScreenTitle title={strings.debug.title} />
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((item) => {
          const selected = item === tab;
          return (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setTab(item)}
              style={[styles.tab, selected ? styles.tabSelected : null]}>
              <Text style={[styles.tabLabel, selected ? styles.tabLabelSelected : null]}>{TAB_LABEL[item]}</Text>
            </Pressable>
          );
        })}
      </View>
      {tab === 'controls' ? (
        <ScrollView style={styles.body} contentContainerStyle={styles.controls} showsVerticalScrollIndicator={false}>
          <ConnectionInfo />
          <DebugControls />
        </ScrollView>
      ) : (
        <View style={styles.body}>
          <DebugLogs />
        </View>
      )}
      <View style={styles.back}>
        <ActionButton
          label={backToStation ? strings.debug.backToStation : strings.debug.backToConnect}
          variant="secondary"
          onPress={onBack}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    marginTop: tokens.space.lg,
    padding: 4,
    borderRadius: tokens.radius.card,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
  },
  tab: {
    flex: 1,
    minHeight: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 8,
  },
  tabSelected: {
    backgroundColor: palette.accent,
  },
  tabLabel: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  tabLabelSelected: {
    color: palette.onAccent,
  },
  body: {
    flex: 1,
    marginTop: tokens.space.md,
  },
  controls: {
    gap: tokens.space.md,
    paddingBottom: tokens.space.sm,
  },
  back: {
    paddingTop: tokens.space.md,
  },
});
