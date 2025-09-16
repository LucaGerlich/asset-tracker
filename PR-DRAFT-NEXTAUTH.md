Title: feat(auth): Add NextAuth credentials + bcrypt password security

Summary
- Integrates NextAuth (Credentials provider) with JWT sessions.
- Adds login page and navbar auth UI (sign-in/out).
- Hashes passwords with bcrypt on user creation; supports legacy plaintext during transition.
- Adds password management endpoints: change own password, admin reset.
- Provides script to rehash existing plaintext passwords.

Changes
- API
  - app/api/auth/[...nextauth]/route.js: NextAuth handler using shared authOptions.
  - app/api/user/changePassword/route.js: Authenticated user password change.
  - app/api/user/adminSetPassword/route.js: Admin-only set password for users.
  - app/api/user/addUser/route.js: Hashes new passwords with bcrypt.
- Auth config
  - app/lib/authOptions.js: Centralized NextAuth configuration.
  - app/lib/providers.jsx: Wrap with SessionProvider for client components.
- UI
  - app/login/page.jsx: Credentials login form.
  - app/components/Navigation.jsx: Sign-in button when logged out; avatar + log out when logged in.
- Tooling
  - scripts/rehash-passwords.js: Rehash non-bcrypt passwords.
  - package.json: Add next-auth, bcryptjs; add `rehash:passwords` script.
  - .env: Add NEXTAUTH_SECRET placeholder.

Security Notes
- Bcrypt is used for all new/updated passwords.
- Authorize flow verifies bcrypt hashes; falls back to plaintext for pre-existing users until migration.
- Recommend running the rehash script, or forcing password change for impacted users.

Env Vars
- NEXTAUTH_SECRET: Generate strong secret (e.g., `openssl rand -base64 32`).
- NEXTAUTH_URL: Set in production (e.g., https://your-domain).

Testing Steps
1) Install deps: `bun install` (or `npm i`).
2) Set `.env` with `NEXTAUTH_SECRET`.
3) Start dev: `bun run dev`.
4) Create a user: POST `/api/user/addUser` with JSON body including firstname, lastname, password, etc.
5) Log in: Go to `/login`, enter email/username + password, expect redirect to `/` and navbar shows avatar + Log Out.
6) Change password: POST `/api/user/changePassword` with `{ currentPassword, newPassword }`, then re-login with new password.
7) Admin set password: As admin, POST `/api/user/adminSetPassword` with `{ userId, newPassword }`, then verify login as that user.
8) Migration: Run `bun run rehash:passwords` to convert legacy plaintext to bcrypt (skips empty values).

Migration Considerations
- Users with empty or unknown plaintext passwords are skipped by the script; prompt them to reset.
- Consider adding a UI for password change under `/user/[id]/settings`.

Screenshots
- Login page and navbar after sign-in (to be attached).

Checklist
- [ ] NEXTAUTH_SECRET set in production
- [ ] Passwords migrated or policy to force reset communicated
- [ ] Basic auth flows verified (sign in/out, change password)

