# توازن — Diet Planner

A maintainable React/TypeScript rebuild of the original single-file Arabic diet-plan experience.

This repository now contains two clients: the original responsive web app and a native Expo app for iOS and Android in [`mobile/`](./mobile/README.md).

## What is included

- Responsive Arabic RTL dashboard for desktop and mobile
- Full 61-option source meal catalogue with recipe links and all 18 fruit choices
- Daily planning, named presets, print layout, reset controls, and no-repeat week generation
- Live calorie and macro calculations
- Two-portion fruit selector
- Water tracking, six daily adherence tasks, streaks, and 14-day history
- Weight history and progress charts
- BMI, BMR, TDEE, safe pace, and calculated macro targets that can be applied to the plan
- Goal-aware workout schedules for eight sport preferences, with exercise references
- Camera/gallery barcode detection, product lookup, offline examples, history, and shopping list
- Arabic/English/French navigation plus light, dark, and system themes
- Username/password accounts with one-way password hashing, recovery codes, and optional welcome-email delivery
- Per-account profiles, preferences, progress, meal selections, and upload history
- Local PDF diet-plan import with editable calorie/macro targets and four-meal extraction
- Automatic account-scoped persistence with `localStorage`

## Account and PDF flow

New users create a profile, save the one-time recovery code, and are then prompted to upload a text-based PDF diet plan. The importer extracts daily calories, protein, carbohydrates, fat, breakfast, snack, lunch, dinner, and common plan notes. Extracted targets remain editable before the plan is loaded. A connected plan can be replaced later from Settings.

The signup form also collects a recovery email. When `VITE_RECOVERY_API_URL` points to the included recovery service, the user receives a branded welcome email containing the username and offline recovery code. Passwords are intentionally excluded from email and remain available only to the user who created them.

PDF parsing happens in the browser. The PDF file itself is not retained; only the extracted plan data is saved to the active account.

This repository is a self-contained client-side app. Accounts are isolated within the current browser profile and device, but they are not server-backed. A public multi-device deployment should connect the same UI to a backend identity provider and database, move password recovery to a verified email/SMS flow, and enforce authorization server-side.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Native iOS and Android app

The Expo SDK 57 app includes native account storage, PDF plan import, meal planning, progress, profile, workouts, barcode scanning, English/Arabic/French localization, and device theme support.

```bash
cd mobile
npm install
npm run ios      # iOS Simulator on macOS
npm run android  # Android emulator or connected device
```

See [`mobile/README.md`](./mobile/README.md) for device testing and store-build instructions.

## Production build

```bash
npm run build
npm run preview
```

Set the GitHub Actions repository variable `RECOVERY_API_URL` to the public HTTPS URL of `mobile/recovery-server` to enable welcome-email delivery in the published web app. Configure the server with a verified Resend sender as documented in [`mobile/recovery-server/README.md`](./mobile/recovery-server/README.md).

## Structure

```text
src/
├── components/    Reusable layout and meal selection UI
├── hooks/         Local persistence hook
├── pages/         Feature-focused screens for planning, tracking, health, scan, and workouts
├── services/      Account/session management and local PDF-plan extraction
├── App.tsx        Shared application state and routing
├── data.ts        Typed meal and fruit catalogue
├── types.ts       Domain types
└── utils.ts       Week generation plus nutrition and health calculations
```

Nutrition values are planning estimates and are not medical advice.
