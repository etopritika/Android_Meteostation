import { PermissionsAndroid, Platform } from 'react-native';

import type { AddressedDevice, Hc05SearchStatus, NamedDevice } from '@/bluetooth/types';
import { strings } from '@/constants/strings';

const HC05_DEVICE_NAME = 'HC-05';
const HC05_NAME_PATTERN = /^HC-05([^A-Z0-9]|$)/;
const RUNTIME_PERMISSIONS_API = 23;
const ANDROID_12_API = 31;

export const HC05_STATUS_LABEL: Record<Hc05SearchStatus, string> = {
  paired: strings.bluetooth.paired,
  discovered: strings.bluetooth.discovered,
  searching: strings.bluetooth.searching,
  notFound: strings.bluetooth.notFound,
  bluetoothOff: strings.bluetooth.bluetoothOff,
  error: strings.bluetooth.error,
};

/**
 * Matches the HC-05 name only. Bond state is decided separately by the caller:
 * a bonded module is saved without discovery, and a discovered one comes from the scan.
 */
export function isHc05Device(device: NamedDevice): boolean {
  if (!device.name) {
    return false;
  }

  const name = device.name.replace(/\0/g, '').trim().toUpperCase();
  return name === HC05_DEVICE_NAME || HC05_NAME_PATTERN.test(name);
}

export function pickHc05<T extends AddressedDevice>(devices: T[]): T | undefined {
  const seen = new Set<string>();

  for (const device of devices) {
    const address = device.address.trim().toUpperCase();
    if (!address || seen.has(address)) {
      continue;
    }

    seen.add(address);
    if (isHc05Device(device)) {
      return device;
    }
  }

  return undefined;
}

export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0;
  if (apiLevel < RUNTIME_PERMISSIONS_API) {
    return true;
  }

  const permissions =
    apiLevel >= ANDROID_12_API
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const result = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every((permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
}

export function readNativeError(error: unknown): { code?: string; message?: string } {
  if (typeof error === 'object' && error !== null) {
    const record = error as { code?: unknown; message?: unknown };
    return {
      code: typeof record.code === 'string' ? record.code : undefined,
      message: typeof record.message === 'string' ? record.message : undefined,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return {};
}
