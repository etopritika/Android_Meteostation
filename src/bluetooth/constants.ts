export const BLUETOOTH_DELIMITER = '\n';

export const BLUETOOTH_ERROR_CODES = {
  pairingFailed: 'PAIRING_FAILED',
  bluetoothNotEnabled: 'BLUETOOTH_NOT_ENABLED',
  alreadyConnecting: 'ALREADY_CONNECTING',
  connectionFailed: 'CONNECTION_FAILED',
  connectionLost: 'CONNECTION_LOST',
  alreadyConnected: 'ALREADY_CONNECTED',
  notCurrentlyConnected: 'NOT_CURRENTLY_CONNECTED',
  inDiscovery: 'BLUETOOTH_IN_DISCOVERY',
} as const;

export const BLUETOOTH_DEBUG_LOG_LIMIT = 150;

export const SERVICE_CONFIRMATION_TIMEOUT_MS = 4000;
