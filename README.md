# Humble Gizmo

Humble Gizmo redeems your Humble Bundle Steam keys for you, so you do not have to paste them in one
at a time.

## Download

Pick your system. If a link does not work, use the [latest release page](https://github.com/bobbyrc/humble-gizmo/releases/latest).

- [Download for macOS](https://github.com/bobbyrc/humble-gizmo/releases/latest/download/Humble-Gizmo-mac.dmg) (`.dmg`, Apple Silicon and Intel)
- [Download for Windows](https://github.com/bobbyrc/humble-gizmo/releases/latest/download/Humble-Gizmo-Setup.exe) (`.exe` installer)
- [Download for Linux](https://github.com/bobbyrc/humble-gizmo/releases/latest/download/Humble-Gizmo.AppImage) (`.AppImage`)

## Is it safe?

**Your data stays on this computer.**

This app only talks to Humble Bundle and Steam.

Nothing is sent to the developer unless you turn it on below.

Not affiliated with Humble Bundle or Valve.

## Windows: "Windows protected your PC"

Windows may show a blue SmartScreen warning the first time you run the installer, because the app
is new and not yet widely downloaded. To continue:

1. Click **More info**.

   <!-- screenshot: SmartScreen dialog with the "More info" link -->

2. Click **Run anyway**.

   <!-- screenshot: SmartScreen dialog with the "Run anyway" button -->

## For developers

```sh
npm ci            # install dependencies
npm run dev       # run the app in development mode
npm test          # run the unit tests
npm run probe     # run the live Humble/Steam probe
```

Releases are cut by the owner; see [docs/RELEASING.md](docs/RELEASING.md).
