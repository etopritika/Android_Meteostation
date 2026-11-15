import { useState, useSyncExternalStore } from 'react';
import { FlatList, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { clearBluetoothDebugLog, getBluetoothDebugLog, subscribeBluetoothDebugLog } from '@/bluetooth/debug';
import type { BluetoothDebugCategory, BluetoothDebugEntry } from '@/bluetooth/types';
import { ActionButton } from '@/components/action-button';
import { strings } from '@/constants/strings';
import { palette } from '@/theme/palette';
import { tokens } from '@/theme/tokens';

const FILTERS = ['all', 'TX', 'RX', 'ERR', 'SYS'] as const;

type DebugLogFilter = (typeof FILTERS)[number];

const CATEGORY_COLOR: Record<BluetoothDebugCategory, string> = {
  TX: palette.accent,
  RX: palette.logRx,
  ERR: palette.error,
  SYS: palette.logSys,
};

function filterLabel(filter: DebugLogFilter): string {
  return filter === 'all' ? strings.debug.filterAll : strings.debug.category[filter];
}

function formatLogTime(time: number): string {
  const date = new Date(time);
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

function formatShareTime(time: number): string {
  const date = new Date(time);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatSharedLog(entries: readonly BluetoothDebugEntry[]): string {
  const lines = entries.map((entry) => `[${formatShareTime(entry.time)}] ${entry.category} ${entry.message}`);
  return [strings.debug.shareHeader, '', ...lines].join('\n');
}

export function DebugLogs() {
  const entries = useSyncExternalStore(subscribeBluetoothDebugLog, getBluetoothDebugLog, getBluetoothDebugLog);
  const [filter, setFilter] = useState<DebugLogFilter>('all');
  const [shareError, setShareError] = useState<string | null>(null);
  const visible = filter === 'all' ? entries : entries.filter((entry) => entry.category === filter);

  const onShare = async () => {
    if (entries.length === 0) {
      return;
    }

    setShareError(null);
    try {
      await Share.share({ message: formatSharedLog(entries) });
    } catch {
      setShareError(strings.debug.shareFailed);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.logsTitle}>{strings.debug.logsTitle}</Text>
      <View style={styles.filters}>
        {FILTERS.map((item) => {
          const selected = item === filter;
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setFilter(item)}
              style={[styles.filter, selected ? styles.filterSelected : null]}>
              <Text style={[styles.filterLabel, selected ? styles.filterLabelSelected : null]}>{filterLabel(item)}</Text>
            </Pressable>
          );
        })}
      </View>
      <FlatList
        style={styles.list}
        data={visible}
        keyExtractor={(entry) => String(entry.id)}
        renderItem={({ item }) => <LogEntry entry={item} />}
        ListEmptyComponent={
          <Text style={styles.empty}>{entries.length === 0 ? strings.debug.emptyLog : strings.debug.emptyFilter}</Text>
        }
        contentContainerStyle={visible.length === 0 ? styles.emptyList : styles.listContent}
      />
      {shareError ? <Text style={styles.shareError}>{shareError}</Text> : null}
      <View style={styles.actions}>
        <View style={styles.actionSlot}>
          <ActionButton label={strings.debug.clearLog} variant="secondary" onPress={clearBluetoothDebugLog} />
        </View>
        <View style={styles.actionSlot}>
          <ActionButton label={strings.debug.share} variant="secondary" disabled={entries.length === 0} onPress={() => void onShare()} />
        </View>
      </View>
    </View>
  );
}

function LogEntry({ entry }: { entry: BluetoothDebugEntry }) {
  return (
    <View style={styles.entry}>
      <Text style={styles.meta}>
        {formatLogTime(entry.time)}
        {'  '}
        <Text style={[styles.category, { color: CATEGORY_COLOR[entry.category] }]}>{strings.debug.category[entry.category]}</Text>
      </Text>
      <Text style={styles.message}>{entry.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  logsTitle: {
    color: palette.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.sm,
    marginTop: tokens.space.md,
  },
  filter: {
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    borderRadius: tokens.radius.card,
    backgroundColor: palette.surface,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 8,
  },
  filterSelected: {
    borderColor: palette.accent,
  },
  filterLabel: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  filterLabelSelected: {
    color: palette.accent,
  },
  list: {
    flex: 1,
    marginTop: tokens.space.md,
  },
  listContent: {
    gap: tokens.space.sm,
    paddingBottom: tokens.space.sm,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  empty: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  entry: {
    backgroundColor: palette.surface,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    gap: 4,
  },
  meta: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  category: {
    fontWeight: '700',
  },
  message: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
  },
  shareError: {
    marginTop: tokens.space.sm,
    color: palette.error,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: tokens.space.sm,
    paddingTop: tokens.space.md,
  },
  actionSlot: {
    flex: 1,
  },
});
