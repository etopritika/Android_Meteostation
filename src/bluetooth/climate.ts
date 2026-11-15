import { BLUETOOTH_DELIMITER } from '@/bluetooth/constants';
import { ignoredServiceMessages } from '@/bluetooth/protocol';
import type { ClimateReading } from '@/bluetooth/types';

const CLIMATE_READING_PATTERN = /^TEMP:([+-]?\d+(?:\.\d+)?);HUM:([+-]?\d+(?:\.\d+)?)$/;

function parseClimateLine(line: string): ClimateReading | null {
  const normalized = line.replace(/\s+/g, '');
  if (!normalized || ignoredServiceMessages.has(normalized)) {
    return null;
  }

  const match = CLIMATE_READING_PATTERN.exec(normalized);
  if (!match) {
    return null;
  }

  const temperature = Number(match[1]);
  const humidity = Number(match[2]);
  if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) {
    return null;
  }

  return { temperature, humidity };
}

/**
 * Reads one Bluetooth payload. A valid TEMP/HUM line updates the reading.
 * Service messages and malformed lines return null so the last good values stay.
 */
export function parseClimateMessage(raw: string): ClimateReading | null {
  let latest: ClimateReading | null = null;

  for (const line of raw.split(BLUETOOTH_DELIMITER)) {
    const reading = parseClimateLine(line);
    if (reading) {
      latest = reading;
    }
  }

  return latest;
}
