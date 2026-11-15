import type { BluetoothDevice, BluetoothNativeDevice } from 'react-native-bluetooth-classic';

import { BLUETOOTH_DELIMITER, BLUETOOTH_ERROR_CODES } from '@/bluetooth/constants';
import { readNativeError } from '@/bluetooth/hc05';
import { strings } from '@/constants/strings';

export function addressesMatch(left: string, right: string): boolean {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

export function isBluetoothDevice(device: BluetoothDevice | BluetoothNativeDevice): device is BluetoothDevice {
  return typeof (device as BluetoothDevice).connect === 'function';
}

export function connectionFailedError(): Error {
  return Object.assign(new Error(BLUETOOTH_ERROR_CODES.connectionFailed), { code: BLUETOOTH_ERROR_CODES.connectionFailed });
}

export function connectionErrorMessage(error: unknown): string {
  const { code } = readNativeError(error);

  switch (code) {
    case BLUETOOTH_ERROR_CODES.pairingFailed:
      return strings.errors.pairingFailed;
    case BLUETOOTH_ERROR_CODES.bluetoothNotEnabled:
      return strings.errors.bluetoothDisabled;
    case BLUETOOTH_ERROR_CODES.alreadyConnecting:
      return strings.errors.alreadyConnecting;
    case BLUETOOTH_ERROR_CODES.connectionFailed:
    case BLUETOOTH_ERROR_CODES.connectionLost:
      return strings.errors.connectionFailed;
    default:
      return strings.errors.connectFailed;
  }
}

async function releaseFailedSocket(device: BluetoothDevice, isCurrent: () => boolean): Promise<void> {
  if (!isCurrent()) {
    return;
  }

  await device.disconnect().catch(() => undefined);
}

export async function openSocket(device: BluetoothDevice, isCurrent: () => boolean): Promise<BluetoothDevice> {
  try {
    if (await device.isConnected()) {
      return device;
    }

    const opened = await device.connect({ delimiter: BLUETOOTH_DELIMITER });
    if (!opened) {
      throw connectionFailedError();
    }
  } catch (error) {
    if (readNativeError(error).code !== BLUETOOTH_ERROR_CODES.alreadyConnected) {
      await releaseFailedSocket(device, isCurrent);
      throw error;
    }
  }

  try {
    if (await device.isConnected()) {
      return device;
    }
  } catch (error) {
    await releaseFailedSocket(device, isCurrent);
    throw error;
  }

  await releaseFailedSocket(device, isCurrent);
  throw connectionFailedError();
}
