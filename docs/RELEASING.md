# Releasing Humble Gizmo

Pushing a tag that starts with `v` runs `.github/workflows/release.yml`. It builds on macOS,
Windows and Linux, runs the tests, and uploads the installers to a GitHub release for the repo
`bobbyrc/humble-gizmo`. Only the owner cuts releases.

## Cutting a release

1. Set `version` in `package.json` (and `package-lock.json`) to the new number, for example `0.2.0`.
2. Run `npm test && npm run typecheck && npm run lint`.
3. Commit and push the version bump to `main`.
4. Tag it and push the tag. The tag must match the version:

   ```sh
   git tag v0.2.0
   git push origin v0.2.0
   ```

5. Watch the Actions run. When all three jobs finish, check the release page, then publish it if
   electron-builder left it as a draft.

## Repository secrets

Add these under Settings -> Secrets and variables -> Actions -> New repository secret. The names
must match exactly. `GITHUB_TOKEN` is provided by GitHub automatically; do not create it.

| Secret             | Used for                                                       |
| ------------------ | -------------------------------------------------------------- |
| `CSC_LINK`         | Base64 of the Developer ID Application certificate (.p12)      |
| `CSC_KEY_PASSWORD` | Password you chose when exporting the .p12                     |
| `APPLE_API_KEY`    | Full text contents of the App Store Connect API key (.p8 file) |
| `APPLE_API_KEY_ID` | Key ID of that API key                                         |
| `APPLE_API_ISSUER` | Issuer ID of your App Store Connect team                       |

All five are used only by the macOS job, for code signing and notarization (Apple's malware scan,
which lets the app open without a warning).

### CSC_LINK and CSC_KEY_PASSWORD (signing certificate)

1. Sign in at <https://developer.apple.com/account> -> Certificates, Identifiers & Profiles ->
   Certificates -> the + button.
2. Choose **Developer ID Application** and continue. It asks for a Certificate Signing Request
   (CSR).
3. On your Mac open Keychain Access -> Certificate Assistant -> Request a Certificate From a
   Certificate Authority. Enter your email, choose "Saved to disk", and save the `.certSigningRequest`.
4. Upload the CSR on the Apple page, download the resulting `.cer`, and double-click it to add it to
   your login keychain.
5. In Keychain Access -> My Certificates, find "Developer ID Application: Your Name (TEAMID)".
   Expand it so the private key shows, select the certificate (not only the key), right-click ->
   Export, and save as `.p12`. Choose a strong password. That password is `CSC_KEY_PASSWORD`.
6. Base64 encode the file and copy it: `base64 -i DeveloperID.p12 | pbcopy`. Paste the clipboard as
   the `CSC_LINK` secret.
7. Delete the `.p12` from disk once both secrets are saved.

### APPLE_API_KEY, APPLE_API_KEY_ID and APPLE_API_ISSUER (notarization)

1. Sign in at <https://appstoreconnect.apple.com> -> Users and Access -> Integrations -> App Store
   Connect API -> Team Keys. (First time only: click Request Access.)
2. Click +, name the key (for example "Humble Gizmo CI"), set Access to **Developer**, and
   generate.
3. Download the `.p8` file. Apple lets you download it once only. Keep a copy somewhere safe.
4. `APPLE_API_KEY_ID`: the **Key ID** shown in the key's row (about 10 characters).
5. `APPLE_API_ISSUER`: the **Issuer ID** shown at the top of the Keys page (a UUID).
6. `APPLE_API_KEY`: open the `.p8` in a text editor and paste its entire contents, including the
   `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines. The workflow writes this
   text to a temporary file on the runner and points `APPLE_API_KEY` at that file, which is the
   form electron-builder expects.

## Windows and Linux

No secrets are needed. Windows installers are not code signed, so users see a SmartScreen warning;
the README explains how to continue past it.
