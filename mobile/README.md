# Tawazon Native

Native iOS and Android edition of the Tawazon diet planner, built with Expo SDK 57, React Native, and TypeScript.

## Features

- Supabase-backed username/password accounts with recovery email and offline backup codes
- App-session tokens stored with the platform Keychain/Keystore through SecureStore
- Cross-device profiles, diet plans, progress, settings, meal selections, and private training videos
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

## Cloud accounts and recovery

The app supports both a short-lived Supabase recovery code and the original offline recovery code. Copy the environment template and add the public Supabase project values:

```bash
cp .env.example .env
```

Set `EXPO_PUBLIC_ACCOUNT_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, then restart Expo. Publishable values are intentionally safe to embed; never add a Supabase secret/service-role key to this file.

The checked-in app defaults to the Tawazon Supabase project. These variables are overrides for another environment; the service-role key is never included in the native bundle.

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
├── recovery-server/        Legacy local account service for offline development
├── src/utils/              Nutrition, date, health, and adherence calculations
├── src/data.ts             Meal catalogue, habits, sports, and workouts
├── src/i18n.ts             English, Arabic, and French copy
├── src/theme.ts            Light and dark design tokens
└── src/types.ts            Application domain types
```

## Data and security notes

With the cloud variables configured, Supabase Auth stores passwords, Postgres stores account-scoped application state, and private Storage holds training videos. RLS restricts owner data, while the Edge Function stores only hashed recovery codes and hashed 30-day app-session tokens. Local AsyncStorage remains a cache. PDF processing stays on-device; the PDF file itself is not uploaded or retained.

The PDF reader extracts ordinary text PDFs and Flate-compressed text streams. Scanned PDFs and custom embedded fonts may require manual confirmation in the built-in review editor.

Nutrition values are planning estimates and are not medical advice.
