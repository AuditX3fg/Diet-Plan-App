# Tawazon email recovery service

A small Node.js 22 service for registering recovery emails, delivering branded welcome messages and reset codes through Resend, and verifying short-lived reset codes. No email API key is included in either client bundle.

## Configure

1. Verify a sender domain in Resend and create a sending-only API key.
2. Copy `.env.example` to `.env` and fill in `RESEND_API_KEY` and `RECOVERY_FROM_EMAIL`.
3. Start the server:

```bash
npm run dev
```

4. Copy `mobile/.env.example` to `mobile/.env` and set `EXPO_PUBLIC_RECOVERY_API_URL` to this service's HTTPS URL.

For the web client, set `VITE_RECOVERY_API_URL` locally or the GitHub repository variable `RECOVERY_API_URL` for the Pages workflow.

For local device testing, use the computer's LAN IP. The Android emulator reaches the host at `10.0.2.2`; the iOS Simulator can use `127.0.0.1`. Restart Expo after changing its environment file.

## Security behavior

- Six-digit reset codes expire after 15 minutes.
- A code is invalidated after five failed attempts or one successful verification.
- Resends are limited to once per minute and five times per account per hour.
- General IP throttling is applied.
- Codes are stored only as salted scrypt digests.
- API responses disable caching and do not expose provider errors or recovery codes.
- The transactional email key stays on the server.
- Welcome messages include the username and offline recovery code, but never the plaintext password.

The JSON store is useful for a private deployment or prototype. For a public multi-instance deployment, replace it with a transactional database, add authenticated account registration, put the service behind HTTPS and an edge rate limiter, and define a specific `ALLOWED_ORIGIN`.
