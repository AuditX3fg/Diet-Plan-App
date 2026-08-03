# Tawazon account and synchronization service

A Node.js 22 service providing shared accounts, multi-device sessions, synchronized app data, offline and email password recovery, and branded email delivery. Credentials and session tokens are never stored in either client bundle.

## Configure

1. Verify a sender domain in Resend and create a sending-only API key.
2. Copy `.env.example` to `.env` and fill in `RESEND_API_KEY` and `RECOVERY_FROM_EMAIL`.
3. Start the server:

```bash
npm run dev
```

4. Deploy the service behind HTTPS with one persistent volume containing both `TAWAZON_DB_FILE` and `TAWAZON_MEDIA_DIR`.
5. Copy `mobile/.env.example` to `mobile/.env`, then set `EXPO_PUBLIC_ACCOUNT_API_URL` and `EXPO_PUBLIC_RECOVERY_API_URL` to the service's HTTPS URL.

For the web client, set `VITE_ACCOUNT_API_URL` locally or the GitHub repository variable `ACCOUNT_API_URL` for the Pages workflow. `VITE_RECOVERY_API_URL` remains supported for older deployments.

For local device testing, use the computer's LAN IP. The Android emulator reaches the host at `10.0.2.2`; the iOS Simulator can use `127.0.0.1`. Restart Expo after changing its environment file.

## Security behavior

- Passwords and offline recovery codes use independently salted scrypt hashes.
- Login sessions use 256-bit random bearer tokens; only SHA-256 token digests are stored.
- Sessions expire after 30 days and all sessions are revoked after a password reset.
- Usernames and emails have case-insensitive unique database constraints.
- App state is account-scoped, versioned, and shallow-merged transactionally so web and mobile fields do not overwrite one another.
- Six-digit reset codes expire after 15 minutes.
- A code is invalidated after five failed attempts or one successful verification.
- Resends are limited to once per minute and five times per account per hour.
- General IP throttling is applied.
- Codes are stored only as salted scrypt digests.
- API responses disable caching and do not expose provider errors or recovery codes.
- The transactional email key stays on the server.
- Welcome messages include the username and offline recovery code, but never the plaintext password.
- Training-video metadata and files are account-scoped. Listing, upload, deletion, and byte-range playback all require the owner's bearer session.
- Training uploads accept MP4, MOV, or WebM files up to 100 MB each, with 50 videos per training day and 2 GB per account. Files live under `TAWAZON_MEDIA_DIR`, never in the public web bundle.

The relational schema is in `schema.sql`. SQLite runs in WAL mode and is appropriate for a single service instance with a persistent disk. For horizontal multi-instance scaling, migrate the same schema to PostgreSQL. Always use HTTPS, an edge rate limiter, a persistent encrypted backup, and a specific `ALLOWED_ORIGIN` in production.

## Database layout

- `users`: public identity and profile name
- `credentials`: password and offline recovery hashes
- `sessions`: revocable cross-device login sessions
- `user_state`: versioned canonical diet, profile, tracking, preference, and progress data
- `recovery_challenges`: short-lived email reset challenges
- `email_events`: delivery throttling and audit timestamps
- `training_videos`: account ownership, training-day assignment, media type, size, and the private stored filename

## Persistent training media

Set `TAWAZON_MEDIA_DIR` to a directory on the same persistent encrypted volume as the SQLite database. Back up both together: restoring the database without its media directory leaves video records without files, while restoring files without the database leaves them inaccessible. The service supports one instance with local persistent storage; for horizontal scaling, replace this directory with private object storage and preserve the same authenticated API contract.
