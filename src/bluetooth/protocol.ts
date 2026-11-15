import { BLUETOOTH_DELIMITER } from '@/bluetooth/constants';

export const bluetoothCommands = {
  start: `START${BLUETOOTH_DELIMITER}`,
  stop: `STOP${BLUETOOTH_DELIMITER}`,
  getData: `GET_DATA${BLUETOOTH_DELIMITER}`,
  ledOn: `LED_ON${BLUETOOTH_DELIMITER}`,
  ledOff: `LED_OFF${BLUETOOTH_DELIMITER}`,
} as const;

export const bluetoothResponses = {
  autoOn: 'AUTO:ON',
  autoOff: 'AUTO:OFF',
  ledOn: 'LED:ON',
  ledOff: 'LED:OFF',
  dhtError: 'ERROR:DHT11',
} as const;

export const ignoredServiceMessages = new Set<string>([
  bluetoothResponses.autoOn,
  bluetoothResponses.autoOff,
  bluetoothResponses.ledOn,
  bluetoothResponses.ledOff,
  bluetoothResponses.dhtError,
]);

export function readAutoStream(raw: string): 'on' | 'off' | null {
  let state: 'on' | 'off' | null = null;

  for (const line of raw.split(BLUETOOTH_DELIMITER)) {
    const normalized = line.replace(/\s+/g, '');
    if (normalized === bluetoothResponses.autoOn) {
      state = 'on';
    } else if (normalized === bluetoothResponses.autoOff) {
      state = 'off';
    }
  }

  return state;
}

export function payloadConfirmsLed(raw: string, enabled: boolean): boolean {
  const confirmation = enabled ? bluetoothResponses.ledOn : bluetoothResponses.ledOff;
  return raw.split(BLUETOOTH_DELIMITER).some((line) => line.replace(/\s+/g, '') === confirmation);
}
