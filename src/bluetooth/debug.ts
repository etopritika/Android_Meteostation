import { BLUETOOTH_DEBUG_LOG_LIMIT } from '@/bluetooth/constants';
import type { BluetoothDebugCategory, BluetoothDebugEntry } from '@/bluetooth/types';

let entries: BluetoothDebugEntry[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function publish() {
  listeners.forEach((listener) => listener());
}

export function appendBluetoothDebugEntry(category: BluetoothDebugCategory, message: string) {
  const entry: BluetoothDebugEntry = {
    id: nextId,
    time: Date.now(),
    category,
    message,
  };
  nextId += 1;
  entries = [...entries, entry].slice(-BLUETOOTH_DEBUG_LOG_LIMIT);
  publish();
}

export function clearBluetoothDebugLog() {
  if (entries.length === 0) {
    return;
  }

  entries = [];
  publish();
}

export function getBluetoothDebugLog(): BluetoothDebugEntry[] {
  return entries;
}

export function subscribeBluetoothDebugLog(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
