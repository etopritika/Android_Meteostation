import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import RNBluetoothClassic, { type BluetoothDevice, type BluetoothEventSubscription } from 'react-native-bluetooth-classic';

import { parseClimateMessage } from '@/bluetooth/climate';
import { BLUETOOTH_DELIMITER, BLUETOOTH_ERROR_CODES, SERVICE_CONFIRMATION_TIMEOUT_MS } from '@/bluetooth/constants';
import { appendBluetoothDebugEntry } from '@/bluetooth/debug';
import {
  addressesMatch,
  connectionErrorMessage,
  connectionFailedError,
  isBluetoothDevice,
  openSocket,
} from '@/bluetooth/connection';
import { readNativeError } from '@/bluetooth/hc05';
import { bluetoothCommands, payloadConfirmsLed, readAutoStream } from '@/bluetooth/protocol';
import type { AutoStreamState, BluetoothConnectionContextValue, BluetoothConnectionPhase, Hc05Target, ServiceCommand } from '@/bluetooth/types';
import { strings } from '@/constants/strings';

const LED_CONFIRMATION_TIMEOUT_MS = 4000;

function commandName(command: string): string {
  return command.endsWith(BLUETOOTH_DELIMITER) ? command.slice(0, -BLUETOOTH_DELIMITER.length) : command;
}

function serviceWire(command: ServiceCommand): string {
  switch (command) {
    case 'start':
      return bluetoothCommands.start;
    case 'stop':
      return bluetoothCommands.stop;
    case 'getData':
      return bluetoothCommands.getData;
  }
}

const BluetoothConnectionContext = createContext<BluetoothConnectionContextValue | null>(null);

export function BluetoothConnectionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<BluetoothConnectionPhase>('idle');
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ledError, setLedError] = useState<string | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [ledState, setLedState] = useState<boolean | null>(null);
  const [ledLoading, setLedLoading] = useState(false);
  const [autoStream, setAutoStream] = useState<AutoStreamState>('unknown');
  const [commandError, setCommandError] = useState<string | null>(null);
  const [serviceBusy, setServiceBusy] = useState(false);
  const [awaitingServiceAck, setAwaitingServiceAck] = useState(false);

  const deviceRef = useRef<BluetoothDevice | null>(null);
  const phaseRef = useRef<BluetoothConnectionPhase>('idle');
  const operationRef = useRef(false);
  const connectAttemptRef = useRef(0);
  const readingSubscriptionRef = useRef<BluetoothEventSubscription | null>(null);
  const connectionGenerationRef = useRef(0);
  const pendingLedRef = useRef<boolean | null>(null);
  const ledLoadingRef = useRef(false);
  const ledTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStreamRef = useRef<AutoStreamState>('unknown');
  const serviceBusyRef = useRef(false);
  const pendingServiceRef = useRef<Exclude<ServiceCommand, 'getData'> | null>(null);
  const serviceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectGenerationRef = useRef<number | null>(null);

  const publishPhase = useCallback((next: BluetoothConnectionPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const publishDevice = useCallback((next: BluetoothDevice | null) => {
    deviceRef.current = next;
    setDevice(next);
  }, []);

  const publishAutoStream = useCallback((next: AutoStreamState) => {
    autoStreamRef.current = next;
    setAutoStream(next);
  }, []);

  const releaseServiceWait = useCallback(() => {
    if (serviceTimeoutRef.current) {
      clearTimeout(serviceTimeoutRef.current);
      serviceTimeoutRef.current = null;
    }

    pendingServiceRef.current = null;
    serviceBusyRef.current = false;
    setServiceBusy(false);
    setAwaitingServiceAck(false);
  }, []);

  const resetServiceSession = useCallback(() => {
    releaseServiceWait();
    publishAutoStream('unknown');
    setCommandError(null);
  }, [publishAutoStream, releaseServiceWait]);

  const clearReadings = useCallback(() => {
    setTemperature(null);
    setHumidity(null);
    setLastUpdated(null);
  }, []);

  const stopTelemetry = useCallback(() => {
    readingSubscriptionRef.current?.remove();
    readingSubscriptionRef.current = null;
  }, []);

  const cancelLedWait = useCallback(() => {
    if (ledTimeoutRef.current) {
      clearTimeout(ledTimeoutRef.current);
      ledTimeoutRef.current = null;
    }

    pendingLedRef.current = null;
    ledLoadingRef.current = false;
    setLedLoading(false);
  }, []);

  const resetLed = useCallback(() => {
    connectionGenerationRef.current += 1;
    cancelLedWait();
    setLedState(null);
    setLedError(null);
  }, [cancelLedWait]);

  const beginTelemetry = useCallback(async (socket: BluetoothDevice) => {
    stopTelemetry();
    clearReadings();
    resetLed();
    resetServiceSession();
    const generation = connectionGenerationRef.current;

    const subscription = socket.onDataReceived((event) => {
      if (generation !== connectionGenerationRef.current) {
        return;
      }

      if (!deviceRef.current || !addressesMatch(deviceRef.current.address, socket.address)) {
        return;
      }

      if (typeof event.data !== 'string') {
        return;
      }

      appendBluetoothDebugEntry('RX', event.data);

      const reading = parseClimateMessage(event.data);
      if (reading) {
        setTemperature(reading.temperature);
        setHumidity(reading.humidity);
        setLastUpdated(Date.now());
      }

      const auto = readAutoStream(event.data);
      if (auto) {
        publishAutoStream(auto);
      }

      const pendingService = pendingServiceRef.current;
      const ackMatches = (pendingService === 'start' && auto === 'on') || (pendingService === 'stop' && auto === 'off');
      if (ackMatches) {
        if (serviceTimeoutRef.current) {
          clearTimeout(serviceTimeoutRef.current);
          serviceTimeoutRef.current = null;
        }

        pendingServiceRef.current = null;
        serviceBusyRef.current = false;
        setServiceBusy(false);
        setAwaitingServiceAck(false);
        setCommandError(null);
      }

      const pendingLed = pendingLedRef.current;
      if (pendingLed === null || !payloadConfirmsLed(event.data, pendingLed)) {
        return;
      }

      if (ledTimeoutRef.current) {
        clearTimeout(ledTimeoutRef.current);
        ledTimeoutRef.current = null;
      }

      pendingLedRef.current = null;
      ledLoadingRef.current = false;
      setLedLoading(false);
      setLedState(pendingLed);
      setLedError(null);
      appendBluetoothDebugEntry('SYS', strings.debug.log.ledConfirmed(pendingLed ? commandName(bluetoothCommands.ledOn) : commandName(bluetoothCommands.ledOff)));
    });

    readingSubscriptionRef.current = subscription;

    const startCommand = commandName(bluetoothCommands.start);
    appendBluetoothDebugEntry('TX', strings.debug.log.writeAttempt(startCommand));

    try {
      const started = await socket.write(bluetoothCommands.start);
      if (generation !== connectionGenerationRef.current) {
        return;
      }
      if (!started) {
        appendBluetoothDebugEntry('ERR', strings.debug.log.writeRejected(startCommand));
        setError(strings.errors.telemetryStartFailed);
      }
    } catch {
      if (generation !== connectionGenerationRef.current) {
        return;
      }
      appendBluetoothDebugEntry('ERR', strings.debug.log.writeFailed(startCommand));
      setError(strings.errors.telemetryStartFailed);
    }
  }, [clearReadings, publishAutoStream, resetLed, resetServiceSession, stopTelemetry]);

  const clearConnection = useCallback((nextPhase: BluetoothConnectionPhase, nextError: string | null) => {
    const previousPhase = phaseRef.current;
    const hadDevice = deviceRef.current !== null;
    connectAttemptRef.current += 1;
    stopTelemetry();
    clearReadings();
    resetLed();
    resetServiceSession();
    publishDevice(null);
    setError(nextError);
    publishPhase(nextPhase);

    if (nextError === strings.errors.connectionLost) {
      appendBluetoothDebugEntry('SYS', strings.errors.connectionLost);
    } else if (nextError === strings.errors.bluetoothDisabledDuringConnection) {
      appendBluetoothDebugEntry('SYS', strings.errors.bluetoothDisabledDuringConnection);
    } else if (nextPhase === 'idle' && nextError === null && (hadDevice || previousPhase === 'disconnecting')) {
      appendBluetoothDebugEntry('SYS', strings.debug.log.disconnected);
    }
  }, [clearReadings, publishDevice, publishPhase, resetLed, resetServiceSession, stopTelemetry]);

  const clearError = useCallback(() => {
    setError(null);
    if (phaseRef.current === 'error') {
      publishPhase('idle');
    }
  }, [publishPhase]);

  const connect = useCallback(async (target: Hc05Target) => {
    if (operationRef.current) {
      return false;
    }

    operationRef.current = true;
    const attempt = ++connectAttemptRef.current;
    const attemptIsCurrent = () => connectAttemptRef.current === attempt;
    let socket: BluetoothDevice | undefined;

    const finishIfCancelled = async (socket?: BluetoothDevice) => {
      if (connectAttemptRef.current === attempt) {
        return false;
      }

      if (socket) {
        stopTelemetry();
        if (deviceRef.current && addressesMatch(deviceRef.current.address, socket.address)) {
          publishDevice(null);
        }
        await socket.disconnect().catch(() => undefined);
      }

      resetServiceSession();

      if (phaseRef.current === 'connecting' || phaseRef.current === 'disconnecting') {
        const previousPhase = phaseRef.current;
        publishPhase('idle');
        appendBluetoothDebugEntry('SYS', previousPhase === 'connecting' ? strings.debug.log.connectCancelled : strings.debug.log.disconnected);
      }

      return true;
    };

    try {
      const current = deviceRef.current;
      if (current && addressesMatch(current.address, target.address) && phaseRef.current === 'connected') {
        if (await current.isConnected().catch(() => false)) {
          if (await finishIfCancelled(current)) {
            return false;
          }
          if (!readingSubscriptionRef.current) {
            await beginTelemetry(current);
          }
          if (await finishIfCancelled(current)) {
            return false;
          }
          return true;
        }
        if (await finishIfCancelled()) {
          return false;
        }
      }

      setError(null);
      publishPhase('connecting');
      appendBluetoothDebugEntry('SYS', strings.debug.log.connecting);

      if (current && !addressesMatch(current.address, target.address)) {
        stopTelemetry();
        clearReadings();
        resetLed();
        resetServiceSession();
        publishDevice(null);
        await current.disconnect().catch(() => undefined);
        appendBluetoothDebugEntry('SYS', strings.debug.log.disconnected);
        if (await finishIfCancelled()) {
          return false;
        }
      }

      if (target.source === 'paired') {
        let pairedDevice: BluetoothDevice | undefined;
        if (isBluetoothDevice(target.device)) {
          pairedDevice = target.device;
        } else {
          const bonded = await RNBluetoothClassic.getBondedDevices();
          if (await finishIfCancelled()) {
            return false;
          }
          pairedDevice = bonded.find((item) => addressesMatch(item.address, target.address));
        }

        if (!pairedDevice) {
          throw connectionFailedError();
        }

        socket = pairedDevice;
        socket = await openSocket(socket, attemptIsCurrent);
      } else {
        const bonded = await RNBluetoothClassic.getBondedDevices();
        if (await finishIfCancelled()) {
          return false;
        }
        const alreadyBonded = bonded.find((item) => addressesMatch(item.address, target.address));
        const partner = alreadyBonded ?? (await RNBluetoothClassic.pairDevice(target.address));
        if (await finishIfCancelled()) {
          return false;
        }
        socket = partner;
        socket = await openSocket(socket, attemptIsCurrent);
      }

      if (await finishIfCancelled(socket)) {
        return false;
      }

      publishDevice(socket);
      await beginTelemetry(socket);
      if (await finishIfCancelled(socket)) {
        return false;
      }
      appendBluetoothDebugEntry('SYS', strings.debug.log.connected);
      publishPhase('connected');
      return true;
    } catch (caught) {
      if (await finishIfCancelled(socket)) {
        return false;
      }

      stopTelemetry();
      clearReadings();
      resetLed();
      resetServiceSession();
      const message = connectionErrorMessage(caught);
      appendBluetoothDebugEntry('ERR', message);
      setError(message);
      publishPhase('error');
      return false;
    } finally {
      operationRef.current = false;
    }
  }, [beginTelemetry, clearReadings, publishDevice, publishPhase, resetLed, resetServiceSession, stopTelemetry]);

  const disconnect = useCallback(async () => {
    if (operationRef.current) {
      if (phaseRef.current === 'disconnecting') {
        return;
      }

      connectAttemptRef.current += 1;
      stopTelemetry();
      clearReadings();
      resetLed();
      resetServiceSession();
      publishDevice(null);
      if (phaseRef.current === 'connected') {
        setError(null);
        publishPhase('disconnecting');
        appendBluetoothDebugEntry('SYS', strings.debug.log.disconnecting);
      } else if (phaseRef.current === 'connecting') {
        setError(null);
      }
      return;
    }

    const current = deviceRef.current;
    if (!current) {
      clearConnection('idle', null);
      return;
    }

    operationRef.current = true;
    const generation = connectionGenerationRef.current;
    disconnectGenerationRef.current = generation;
    publishPhase('disconnecting');
    appendBluetoothDebugEntry('SYS', strings.debug.log.disconnecting);

    const disconnectFinished = () =>
      generation !== connectionGenerationRef.current || phaseRef.current !== 'disconnecting';

    const finishUserDisconnect = () => {
      if (disconnectFinished()) {
        return;
      }

      clearConnection('idle', null);
    };

    try {
      await current.disconnect();
      finishUserDisconnect();
    } catch (caught) {
      if (disconnectFinished()) {
        return;
      }

      if (readNativeError(caught).code === BLUETOOTH_ERROR_CODES.notCurrentlyConnected) {
        finishUserDisconnect();
        return;
      }

      let stillConnected: boolean | null = null;
      try {
        stillConnected = await current.isConnected();
      } catch {
        stillConnected = null;
      }

      if (disconnectFinished()) {
        return;
      }

      if (stillConnected === true) {
        appendBluetoothDebugEntry('ERR', strings.errors.disconnectFailed);
        setError(strings.errors.disconnectFailed);
        publishPhase('connected');
        return;
      }

      if (stillConnected === null) {
        appendBluetoothDebugEntry('ERR', strings.errors.disconnectFailed);
        clearConnection('error', strings.errors.disconnectFailed);
        return;
      }

      finishUserDisconnect();
    } finally {
      if (disconnectGenerationRef.current === generation) {
        disconnectGenerationRef.current = null;
      }
      operationRef.current = false;
    }
  }, [clearConnection, clearReadings, publishDevice, publishPhase, resetLed, resetServiceSession, stopTelemetry]);

  const changeLed = useCallback(async (enabled: boolean) => {
    const socket = deviceRef.current;
    if (!socket || phaseRef.current !== 'connected' || ledLoadingRef.current) {
      return;
    }

    const generation = connectionGenerationRef.current;
    ledLoadingRef.current = true;
    pendingLedRef.current = enabled;
    setLedLoading(true);
    setLedError(null);

    if (ledTimeoutRef.current) {
      clearTimeout(ledTimeoutRef.current);
    }

    ledTimeoutRef.current = setTimeout(() => {
      ledTimeoutRef.current = null;
      if (generation !== connectionGenerationRef.current || pendingLedRef.current !== enabled) {
        return;
      }

      pendingLedRef.current = null;
      ledLoadingRef.current = false;
      setLedLoading(false);
      setLedError(strings.errors.ledTimeout);
      appendBluetoothDebugEntry('ERR', strings.errors.ledTimeout);
    }, LED_CONFIRMATION_TIMEOUT_MS);

    const command = enabled ? bluetoothCommands.ledOn : bluetoothCommands.ledOff;
    const name = commandName(command);

    const failLedCommand = (rejected: boolean) => {
      if (generation !== connectionGenerationRef.current || pendingLedRef.current !== enabled) {
        return;
      }

      if (ledTimeoutRef.current) {
        clearTimeout(ledTimeoutRef.current);
        ledTimeoutRef.current = null;
      }

      pendingLedRef.current = null;
      ledLoadingRef.current = false;
      setLedLoading(false);
      setLedError(strings.errors.ledWriteFailed);
      appendBluetoothDebugEntry('ERR', rejected ? strings.debug.log.writeRejected(name) : strings.debug.log.writeFailed(name));
    };

    appendBluetoothDebugEntry('SYS', strings.debug.log.ledWait(name));
    appendBluetoothDebugEntry('TX', strings.debug.log.writeAttempt(name));

    try {
      const written = await socket.write(command);
      if (!written) {
        failLedCommand(true);
      }
    } catch {
      failLedCommand(false);
    }
  }, []);

  const sendServiceCommand = useCallback(async (command: ServiceCommand) => {
    const socket = deviceRef.current;
    if (!socket || phaseRef.current !== 'connected' || serviceBusyRef.current) {
      return;
    }

    if (command === 'start' && autoStreamRef.current === 'on') {
      return;
    }

    if (command === 'stop' && autoStreamRef.current === 'off') {
      return;
    }

    const generation = connectionGenerationRef.current;
    const wire = serviceWire(command);
    const name = commandName(wire);
    const awaitsAck = command === 'start' || command === 'stop';
    serviceBusyRef.current = true;
    setServiceBusy(true);
    setCommandError(null);

    if (awaitsAck) {
      pendingServiceRef.current = command;
      setAwaitingServiceAck(true);
      if (serviceTimeoutRef.current) {
        clearTimeout(serviceTimeoutRef.current);
      }

      serviceTimeoutRef.current = setTimeout(() => {
        serviceTimeoutRef.current = null;
        if (generation !== connectionGenerationRef.current || pendingServiceRef.current !== command) {
          return;
        }

        pendingServiceRef.current = null;
        serviceBusyRef.current = false;
        setServiceBusy(false);
        setAwaitingServiceAck(false);
        publishAutoStream('unknown');
        const timeoutMessage = strings.errors.serviceConfirmationTimeout(name);
        setCommandError(timeoutMessage);
        appendBluetoothDebugEntry('ERR', timeoutMessage);
      }, SERVICE_CONFIRMATION_TIMEOUT_MS);
    }

    appendBluetoothDebugEntry('TX', strings.debug.log.writeAttempt(name));

    const failWrite = (rejected: boolean) => {
      if (generation !== connectionGenerationRef.current || phaseRef.current !== 'connected') {
        return;
      }

      if (awaitsAck && pendingServiceRef.current !== command) {
        return;
      }

      if (serviceTimeoutRef.current) {
        clearTimeout(serviceTimeoutRef.current);
        serviceTimeoutRef.current = null;
      }

      pendingServiceRef.current = null;
      serviceBusyRef.current = false;
      setServiceBusy(false);
      setAwaitingServiceAck(false);
      appendBluetoothDebugEntry('ERR', rejected ? strings.debug.log.writeRejected(name) : strings.debug.log.writeFailed(name));
      setCommandError(strings.errors.serviceCommandFailed(name));
    };

    try {
      const written = await socket.write(wire);
      if (generation !== connectionGenerationRef.current || phaseRef.current !== 'connected') {
        return;
      }

      if (!written) {
        failWrite(true);
        return;
      }

      if (!awaitsAck) {
        serviceBusyRef.current = false;
        setServiceBusy(false);
      }
    } catch {
      if (generation !== connectionGenerationRef.current || phaseRef.current !== 'connected') {
        return;
      }

      failWrite(false);
    }
  }, [publishAutoStream]);

  useEffect(() => {
    const disconnected = RNBluetoothClassic.onDeviceDisconnected((event) => {
      const current = deviceRef.current;
      if (!current || !addressesMatch(event.device.address, current.address)) {
        return;
      }

      if (phaseRef.current === 'disconnecting') {
        if (disconnectGenerationRef.current !== connectionGenerationRef.current) {
          return;
        }

        clearConnection('idle', null);
        return;
      }

      clearConnection('error', strings.errors.connectionLost);
    });

    const disabled = RNBluetoothClassic.onBluetoothDisabled(() => {
      if (phaseRef.current !== 'connected' && phaseRef.current !== 'connecting') {
        return;
      }

      clearConnection('error', strings.errors.bluetoothDisabledDuringConnection);
    });

    return () => {
      disconnected.remove();
      disabled.remove();
      readingSubscriptionRef.current?.remove();
      readingSubscriptionRef.current = null;
      connectionGenerationRef.current += 1;
      if (ledTimeoutRef.current) {
        clearTimeout(ledTimeoutRef.current);
        ledTimeoutRef.current = null;
      }
      pendingLedRef.current = null;
      ledLoadingRef.current = false;
      if (serviceTimeoutRef.current) {
        clearTimeout(serviceTimeoutRef.current);
        serviceTimeoutRef.current = null;
      }
      pendingServiceRef.current = null;
      serviceBusyRef.current = false;
    };
  }, [clearConnection]);

  const value = useMemo(
    () => ({
      phase,
      device,
      error,
      ledError,
      temperature,
      humidity,
      lastUpdated,
      ledState,
      ledLoading,
      autoStream,
      commandError,
      serviceBusy,
      awaitingServiceAck,
      connect,
      disconnect,
      changeLed,
      sendServiceCommand,
      clearError,
    }),
    [phase, device, error, ledError, temperature, humidity, lastUpdated, ledState, ledLoading, autoStream, commandError, serviceBusy, awaitingServiceAck, connect, disconnect, changeLed, sendServiceCommand, clearError],
  );

  return <BluetoothConnectionContext.Provider value={value}>{children}</BluetoothConnectionContext.Provider>;
}

export function useBluetoothConnection(): BluetoothConnectionContextValue {
  const value = useContext(BluetoothConnectionContext);
  if (!value) {
    throw new Error('useBluetoothConnection must be used within BluetoothConnectionProvider');
  }

  return value;
}
