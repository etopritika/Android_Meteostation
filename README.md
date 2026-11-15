# Android Meteostation

Android client for an Arduino weather station. It discovers an HC-05 module over Bluetooth Classic, shows temperature and humidity, and controls an LED.

This is an educational project. The Arduino firmware is not included.

## Features

- Discover an HC-05 and connect over Bluetooth Classic.
- Monitor temperature and humidity.
- Control the station LED.
- Receive automatic readings, or request one on demand.
- Disconnect, and leave the station screen when a visible connection drops.
- Open developer diagnostics with service commands and a Bluetooth log.

## Tech stack

Declared in `package.json`:

- React Native 0.88.1
- Expo SDK 58 (`expo` ~58.0.25) and Expo Router ~58.0.31
- TypeScript ~6.0.3
- `react-native-bluetooth-classic` ^1.73.0-rc.17

The station is an Arduino Uno with an HC-05 module and a DHT11 sensor. `npm install` runs `patch-package` and applies `patches/react-native-bluetooth-classic+1.73.0-rc.17.patch`.

## Hardware setup

The firmware and wiring diagram are not in this repository. Verify these intended connections against the sketch you flash. Resistor values are not specified here.

| Part | Connection |
| --- | --- |
| DHT11 data | Arduino D2 |
| LED | Arduino D7, through a current-limiting resistor |
| HC-05 TXD | Arduino D10 (software serial RX) |
| HC-05 RXD | Arduino D11 (software serial TX), through a voltage divider |
| Power | Module VCC and a shared ground with the Arduino |

The phone must support Bluetooth Classic.

## Bluetooth protocol

Messages are newline-delimited. Commands are sent with a trailing `\n`.

```text
TEMP:27.6;HUM:41
```

| Command | Response | Purpose |
| --- | --- | --- |
| `START` | `AUTO:ON` | Enable automatic telemetry |
| `STOP` | `AUTO:OFF` | Disable automatic telemetry |
| `GET_DATA` | a `TEMP` / `HUM` line | Request one reading |
| `LED_ON` | `LED:ON` | Turn the LED on |
| `LED_OFF` | `LED:OFF` | Turn the LED off |

`START`, `STOP`, and the LED commands wait up to 4 seconds for the matching response. `GET_DATA` does not wait for a separate acknowledgement. `ERROR:DHT11` is not treated as a reading.

After connecting, the app sends one `START`. The confirmed automatic mode changes only when `AUTO:ON` or `AUTO:OFF` arrives. The station firmware is expected to emit a reading about every two seconds while automatic mode is on. That interval is not set by this app.

## Getting started

Expo Go does not include the Bluetooth Classic module. Install a development build or the release APK below.

1. Install dependencies with `npm install`.
2. Flash the station firmware, then power the Arduino and HC-05.
3. Pair HC-05 in Android Bluetooth settings. The app looks for the name `HC-05`, bonded devices first, and does not store a PIN.
4. Install a native Android build.
5. Open the app, grant the Bluetooth permission, and connect.

## Development and Android builds

A development build contains the native module and still needs Metro:

```bash
npx eas-cli@latest build --platform android --profile development
npx expo start --dev-client
```

`production` in `eas.json` keeps `autoIncrement` and sets the Android build type to `apk`. It does not enable the development client, so the result is a release APK that does not use Metro. In that build, `__DEV__` is false.

```bash
npx eas-cli@latest build --platform android --profile production
```

`eas-cli` is not a project dependency. Typecheck with `npx tsc --noEmit`.

## Project structure

```text
src/app/          Connect, station, and Debug screens
src/bluetooth/    Socket, protocol, TEMP/HUM parser, in-memory log
src/components/   Shared UI and Debug panels
src/hooks/        HC-05 discovery and Debug unlock
src/constants/    User-facing strings
src/theme/        Colors and spacing
patches/          Bluetooth Classic build patch
app.json          Android package and permissions
eas.json          Build profiles
```

`android/` is generated for a native build. Do not edit it by hand.

## Debugging

Debug has two tabs. Controls shows the connection and sends `START`, `STOP`, and `GET_DATA`. Logs stores the latest 150 entries in memory, in the categories `TX`, `RX`, `SYS`, and `ERR`. Filtering does not delete entries. Clear does not disconnect. Share uses the Android share sheet and does not add Bluetooth addresses.

The Debug button is always shown in development. In a release build, tap the title `Метеостанція` five times within four seconds. The unlock lasts until the process ends. It is a developer convenience, not a security control.

## Known limitations

- A dropped connection is not restored automatically.
- The Debug log is kept only in memory.

## License

The root `LICENSE` file is the MIT License text from the Expo application template, copyright 650 Industries, Inc. This repository does not add a separate license for the weather-station application.
