import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import RNBluetoothClassic, { type BluetoothDevice, type BluetoothNativeDevice } from 'react-native-bluetooth-classic';

import { BLUETOOTH_ERROR_CODES } from '@/bluetooth/constants';
import { appendBluetoothDebugEntry } from '@/bluetooth/debug';
import {
  HC05_STATUS_LABEL,
  isHc05Device,
  pickHc05,
  readNativeError,
  requestBluetoothPermissions,
} from '@/bluetooth/hc05';
import type { DiscoverySession, DiscoveryState, Hc05SearchStatus, Hc05Target } from '@/bluetooth/types';
import { strings } from '@/constants/strings';

const SEARCHING: DiscoveryState = {
  status: 'searching',
  detail: '',
  canConnect: false,
  target: null,
};

const BLUETOOTH_OFF: DiscoveryState = {
  status: 'bluetoothOff',
  detail: strings.bluetooth.bluetoothOffDetail,
  canConnect: false,
  target: null,
};

type Hc05DiscoverySession = {
  run: () => Promise<void>;
  lookup: () => Promise<void>;
  stopDiscovery: () => Promise<void>;
  dispose: (afterInvalidate?: () => void) => void;
};

function toTarget(source: Hc05Target['source'], device: BluetoothDevice | BluetoothNativeDevice): Hc05Target {
  return {
    source,
    name: device.name,
    address: device.address,
    device,
  };
}

function logDiscovery(category: 'SYS' | 'ERR', message: string) {
  appendBluetoothDebugEntry(category, message);
}

function createHc05DiscoverySession(publishState: (next: DiscoveryState) => void): Hc05DiscoverySession {
  const session: DiscoverySession = {
    active: true,
    lookupRunning: false,
    enableLookupStarted: false,
    scanning: false,
    acceptingDevices: false,
    lookupToken: 0,
    scanToken: 0,
    target: null,
    subscriptions: [],
    lookup: async () => undefined,
    stopActiveDiscovery: async () => undefined,
  };

  const publish = (next: DiscoveryState) => {
    if (!session.active) {
      return;
    }

    session.target = next.target;
    publishState(next);
  };

  let adapterOn: boolean | null = null;
  let cancelLogged = false;
  let startupPending = false;
  let cancelRequested = false;

  const logAdapter = (enabled: boolean) => {
    if (adapterOn === enabled) {
      return;
    }

    adapterOn = enabled;
    logDiscovery('SYS', enabled ? strings.debug.log.adapterOn : strings.debug.log.adapterOff);
  };

  const logCancel = () => {
    if (cancelLogged) {
      return;
    }

    cancelLogged = true;
    logDiscovery('SYS', strings.debug.log.searchCancelled);
  };

  const publishBluetoothOff = () => {
    session.enableLookupStarted = false;
    logAdapter(false);
    publish(BLUETOOTH_OFF);
  };

  const isCurrentLookup = (lookupToken: number) => session.active && session.lookupToken === lookupToken;

  const cancelAdapterDiscovery = async () => {
    await RNBluetoothClassic.cancelDiscovery().catch(() => undefined);
  };

  session.stopActiveDiscovery = async () => {
    const logUserCancel = cancelRequested && (session.scanning || session.acceptingDevices);
    cancelRequested = false;
    session.scanToken += 1;
    session.acceptingDevices = false;
    session.scanning = false;
    if (logUserCancel) {
      logCancel();
    }
    await cancelAdapterDiscovery();
  };

  const remember = (target: Hc05Target) => {
    if (session.target?.address === target.address && session.target.source === target.source) {
      session.target = target;
      return;
    }

    if (target.source === 'discovered') {
      logDiscovery('SYS', strings.debug.log.discoveryFound);
    }

    publish({
      status: target.source === 'paired' ? 'paired' : 'discovered',
      detail: target.source === 'paired' ? strings.bluetooth.pairedDetail : strings.bluetooth.discoveredDetail(target.name, target.address),
      canConnect: true,
      target,
    });
  };

  const startDiscovery = async (): Promise<BluetoothDevice[]> => {
    try {
      return await RNBluetoothClassic.startDiscovery();
    } catch (error) {
      if (readNativeError(error).code !== BLUETOOTH_ERROR_CODES.inDiscovery || !session.active) {
        throw error;
      }

      await cancelAdapterDiscovery();
      if (!session.active) {
        throw error;
      }

      return RNBluetoothClassic.startDiscovery();
    }
  };

  const discover = async (lookupToken: number) => {
    if (!isCurrentLookup(lookupToken) || session.scanning) {
      return;
    }

    const myToken = ++session.scanToken;
    session.scanning = true;
    session.acceptingDevices = true;
    publish(SEARCHING);
    logDiscovery('SYS', strings.debug.log.discoveryStarted);

    try {
      const devices = await startDiscovery();
      if (!isCurrentLookup(lookupToken) || myToken !== session.scanToken) {
        return;
      }

      if (session.target?.source === 'discovered') {
        const sameDevice = devices.find((device) => device.address === session.target?.address);
        if (sameDevice && session.target) {
          session.target = toTarget('discovered', sameDevice);
        }
        return;
      }

      const match = pickHc05(devices);
      if (match) {
        remember(toTarget('discovered', match));
        return;
      }

      logDiscovery('SYS', strings.debug.log.discoveryEmpty);
      publish({
        status: 'notFound',
        detail: strings.bluetooth.notFoundDetail,
        canConnect: false,
        target: null,
      });
    } catch (error) {
      if (!isCurrentLookup(lookupToken) || session.target) {
        return;
      }

      if (readNativeError(error).code === BLUETOOTH_ERROR_CODES.bluetoothNotEnabled) {
        publishBluetoothOff();
        return;
      }

      logDiscovery('ERR', strings.errors.searchFailed);
      publish({
        status: 'error',
        detail: strings.errors.searchFailed,
        canConnect: false,
        target: null,
      });
    } finally {
      if (session.scanToken === myToken) {
        session.scanning = false;
        session.acceptingDevices = false;
      }
    }
  };

  session.lookup = async () => {
    if (!session.active || session.lookupRunning) {
      return;
    }

    const lookupToken = ++session.lookupToken;
    session.lookupRunning = true;
    session.target = null;
    cancelLogged = false;
    logDiscovery('SYS', strings.debug.log.searchStarted);

    try {
      await session.stopActiveDiscovery();
      if (!isCurrentLookup(lookupToken)) {
        return;
      }

      publish(SEARCHING);
      logDiscovery('SYS', strings.debug.log.bondedCheck);
      const bonded = await RNBluetoothClassic.getBondedDevices();
      if (!isCurrentLookup(lookupToken)) {
        return;
      }

      const paired = pickHc05(bonded);
      if (paired) {
        logDiscovery('SYS', strings.debug.log.bondedFound);
        remember(toTarget('paired', paired));
        return;
      }

      logDiscovery('SYS', strings.debug.log.bondedMissing);
      await discover(lookupToken);
    } catch (error) {
      if (!isCurrentLookup(lookupToken)) {
        return;
      }

      if (readNativeError(error).code === BLUETOOTH_ERROR_CODES.bluetoothNotEnabled) {
        publishBluetoothOff();
        return;
      }

      logDiscovery('ERR', strings.errors.bondedCheckFailed);
      publish({
        status: 'error',
        detail: strings.errors.bondedCheckFailed,
        canConnect: false,
        target: null,
      });
    } finally {
      if (session.lookupToken === lookupToken) {
        session.lookupRunning = false;
      }
    }
  };

  const startEnableLookup = async () => {
    if (!session.active || session.enableLookupStarted) {
      return;
    }

    session.enableLookupStarted = true;
    await session.lookup();
  };

  const run = async () => {
    startupPending = true;

    if (Platform.OS !== 'android') {
      startupPending = false;
      logDiscovery('ERR', strings.errors.androidOnly);
      publish({
        status: 'error',
        detail: strings.errors.androidOnly,
        canConnect: false,
        target: null,
      });
      return;
    }

    logDiscovery('SYS', strings.debug.log.permissions);
    const granted = await requestBluetoothPermissions().catch(() => false);
    if (!session.active) {
      return;
    }
    if (!granted) {
      startupPending = false;
      logDiscovery('ERR', strings.errors.permissionDenied);
      publish({
        status: 'error',
        detail: strings.errors.permissionDenied,
        canConnect: false,
        target: null,
      });
      return;
    }

    const available = await RNBluetoothClassic.isBluetoothAvailable().catch(() => false);
    if (!session.active) {
      return;
    }
    if (!available) {
      startupPending = false;
      logDiscovery('ERR', strings.errors.unsupported);
      publish({
        status: 'error',
        detail: strings.errors.unsupported,
        canConnect: false,
        target: null,
      });
      return;
    }

    session.subscriptions.push(
      RNBluetoothClassic.onDeviceDiscovered((event) => {
        if (!session.active || !session.acceptingDevices || !isHc05Device(event.device)) {
          return;
        }

        if (session.target?.address === event.device.address) {
          return;
        }

        session.acceptingDevices = false;
        remember(toTarget('discovered', event.device));
        void session.stopActiveDiscovery();
      }),
      RNBluetoothClassic.onBluetoothEnabled(() => {
        logAdapter(true);
        void startEnableLookup();
      }),
      RNBluetoothClassic.onBluetoothDisabled(() => {
        session.enableLookupStarted = false;
        session.lookupRunning = false;
        session.lookupToken += 1;
        session.target = null;
        logAdapter(false);
        void session.stopActiveDiscovery();
        publish(BLUETOOTH_OFF);
      }),
    );

    logDiscovery('SYS', strings.debug.log.adapter);
    const enabled = await RNBluetoothClassic.isBluetoothEnabled().catch(() => false);
    if (!session.active) {
      return;
    }
    if (!enabled) {
      logAdapter(false);
      publish(BLUETOOTH_OFF);
      const turnedOn = await RNBluetoothClassic.requestBluetoothEnabled().catch(() => false);
      if (!session.active || !turnedOn) {
        startupPending = false;
        publish(BLUETOOTH_OFF);
        return;
      }
      logAdapter(true);
    } else {
      logAdapter(true);
    }

    startupPending = false;
    await startEnableLookup();
  };

  return {
    run,
    lookup: () => session.lookup(),
    stopDiscovery: () => {
      cancelRequested = true;
      return session.stopActiveDiscovery();
    },
    dispose: (afterInvalidate) => {
      const searchInProgress = startupPending || session.lookupRunning || session.scanning || session.acceptingDevices;
      session.active = false;
      session.lookupToken += 1;
      afterInvalidate?.();
      session.subscriptions.forEach((subscription) => subscription.remove());
      if (searchInProgress) {
        logCancel();
      }
      void session.stopActiveDiscovery();
    },
  };
}

export function useHc05Discovery(): {
  status: Hc05SearchStatus;
  statusLabel: string;
  detail: string;
  canConnect: boolean;
  target: Hc05Target | null;
  searchAgain: () => void;
  stopDiscovery: () => Promise<void>;
} {
  const [state, setState] = useState<DiscoveryState>(SEARCHING);
  const sessionRef = useRef<Hc05DiscoverySession | null>(null);

  useFocusEffect(
    useCallback(() => {
      const session = createHc05DiscoverySession(setState);
      sessionRef.current = session;
      void session.run();

      return () => {
        session.dispose(() => {
          sessionRef.current = null;
        });
      };
    }, []),
  );

  const searchAgain = useCallback(() => {
    void sessionRef.current?.lookup();
  }, []);

  const stopDiscovery = useCallback(() => {
    return sessionRef.current?.stopDiscovery() ?? Promise.resolve();
  }, []);

  return {
    status: state.status,
    statusLabel: HC05_STATUS_LABEL[state.status],
    detail: state.detail,
    canConnect: state.canConnect,
    target: state.target,
    searchAgain,
    stopDiscovery,
  };
}
