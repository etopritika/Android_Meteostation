import type { BluetoothDevice, BluetoothEventSubscription, BluetoothNativeDevice } from 'react-native-bluetooth-classic';

export type NamedDevice = {
  name?: string | null;
};

export type AddressedDevice = NamedDevice & {
  address: string;
};

export type Hc05Target = {
  source: 'paired' | 'discovered';
  name: string;
  address: string;
  device: BluetoothDevice | BluetoothNativeDevice;
};

export type Hc05SearchStatus = 'paired' | 'discovered' | 'searching' | 'notFound' | 'bluetoothOff' | 'error';

export type DiscoveryState = {
  status: Hc05SearchStatus;
  detail: string;
  canConnect: boolean;
  target: Hc05Target | null;
};

export type DiscoverySession = {
  active: boolean;
  lookupRunning: boolean;
  enableLookupStarted: boolean;
  scanning: boolean;
  acceptingDevices: boolean;
  lookupToken: number;
  scanToken: number;
  target: Hc05Target | null;
  subscriptions: BluetoothEventSubscription[];
  lookup: () => Promise<void>;
  stopActiveDiscovery: () => Promise<void>;
};

export type BluetoothConnectionPhase = 'idle' | 'connecting' | 'connected' | 'disconnecting' | 'error';

export type AutoStreamState = 'on' | 'off' | 'unknown';

export type ServiceCommand = 'start' | 'stop' | 'getData';

export type BluetoothConnectionContextValue = {
  phase: BluetoothConnectionPhase;
  device: BluetoothDevice | null;
  error: string | null;
  ledError: string | null;
  temperature: number | null;
  humidity: number | null;
  lastUpdated: number | null;
  ledState: boolean | null;
  ledLoading: boolean;
  autoStream: AutoStreamState;
  commandError: string | null;
  serviceBusy: boolean;
  awaitingServiceAck: boolean;
  connect: (target: Hc05Target) => Promise<boolean>;
  disconnect: () => Promise<void>;
  changeLed: (enabled: boolean) => Promise<void>;
  sendServiceCommand: (command: ServiceCommand) => Promise<void>;
  clearError: () => void;
};

export type ClimateReading = {
  temperature: number;
  humidity: number;
};

export type BluetoothDebugCategory = 'TX' | 'RX' | 'ERR' | 'SYS';

export type BluetoothDebugEntry = {
  id: number;
  time: number;
  category: BluetoothDebugCategory;
  message: string;
};
