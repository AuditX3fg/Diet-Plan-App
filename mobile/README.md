# Tawazon Native

Native iOS and Android edition of the Tawazon diet planner, built with Expo SDK 57, React Native, and TypeScript.

## Features

- Username/password accounts with recovery email, salted password hashing, and offline backup codes
- Credentials and session data stored with the platform Keychain/Keystore through SecureStore
- Per-account profiles, diet plans, progress, settings, and meal selections
- Native PDF diet-plan picker with on-device text extraction and an editable review step
- 61 illustrated meal options with independent multi-selection and quarter-portion controls
- Daily calories/macros, water, habits, weight progress, workout plans, and health calculations
- Native barcode camera scanning, product lookup, manual entry, and scan history
- English, Arabic, and French UI with light, dark, and system themes

## Requirements

- Node.js 22 or newer
- npm
- For iOS: macOS with a current Xcode and an iOS Simulator, or Expo Go on a supported device
- For Android: Android Studio/emulator, a connected device, or Expo Go

## Install and run

```bash
cd mobile
npm install
npm start
```

From the Expo terminal, press `i` for iOS or `a` for Android. You can also launch directly:

```bash
npm run ios
npm run android
```

The camera and SecureStore integrations are native modules. Test barcode scanning on a physical device for the most reliable result.

## Email password recovery

The app supports both a short-lived six-digit email code and the original offline recovery code. Email delivery requires the included server so the transactional-email API key never ships inside the app:

```bash
cd recovery-server
cp .env.example .env
# Add a Resend sending-only key and a sender on your verified domain.
npm run dev
```

Then copy `mobile/.env.example` to `mobile/.env`, set `EXPO_PUBLIC_RECOVERY_API_URL`, and restart Expo. See [`recovery-server/README.md`](./recovery-server/README.md) for emulator/device addresses and production hardening.

Without that environment variable, account creation still works and shows the offline recovery code, but the app clearly reports that email recovery is not configured.

New accounts require an email. An older account created before this feature can connect an email from Settings while it is still signed in. If an older account has already lost both its password and offline code before connecting an email, there is intentionally no local bypass; create a new account or restore the app's device data from a backup.

## Verification

```bash
npm run typecheck
npx expo install --check
npx expo export --platform ios --output-dir /tmp/tawazon-ios
npx expo export --platform android --output-dir /tmp/tawazon-android
```

## Store builds

The application identifiers are configured as `com.auditx3fg.tawazon`. Signed binaries require an Expo account plus Apple and/or Google signing credentials:

```bash
npx eas-cli build --platform ios
npx eas-cli build --platform android
# or
npx eas-cli build --platform all
```

Update the identifiers in `app.json` before the first store submission if another organization owns the final bundle/package name.

## Architecture

```text
mobile/
├── App.tsx                 Session, onboarding, persistence, and navigation
├── src/components/         Shared native UI, images, and tab navigation
├── src/screens/            Auth, PDF import, Today, Plan, Progress, Profile, More
├── src/services/           Account security, PDF extraction, per-user storage
├── recovery-server/        Rate-limited email recovery API and Resend delivery
├── src/utils/              Nutrition, date, health, and adherence calculations
├── src/data.ts             Meal catalogue, habits, sports, and workouts
├── src/i18n.ts             English, Arabic, and French copy
├── src/theme.ts            Light and dark design tokens
└── src/types.ts            Application domain types
```

## Data and security notes

The current app is private to the device: account credentials use SecureStore, while non-secret account data is isolated by account in AsyncStorage. Recovery email addresses are registered with the configured recovery service. PDF processing is performed on the device; the PDF file is not uploaded or retained, only the reviewed plan data is saved.

This is not a multi-device cloud identity system. A production service requiring sync between devices, verified email/SMS recovery, clinician access, or server-side authorization should connect the same client to a backend identity provider and database.

The PDF reader extracts ordinary text PDFs and Flate-compressed text streams. Scanned PDFs and custom embedded fonts may require manual confirmation in the built-in review editor.

Nutrition values are planning estimates and are not medical advice.
