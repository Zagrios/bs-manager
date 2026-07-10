# Contributing to BSManager

[code-of-conduct]: CODE_OF_CONDUCT.md
[fork]: https://github.com/Zagrios/bs-manager/fork
[pr]: https://github.com/Zagrios/bs-manager/compare
[style]: https://github.com/basarat/typescript-book/blob/master/docs/styleguide/styleguide.md

Hello! We’re delighted that you’re interested in contributing to **BSManager**. Your help is essential to maintaining and improving this project.

> [!NOTE]  
> This project is released with a [Contributor Code of Conduct][code-of-conduct]. By participating, you agree to abide by its terms.

---

## Opening Issues

- **Reporting Bugs**  
  If you find a bug or any unexpected behavior, feel free to open an issue. Be sure to include steps to reproduce it, relevant logs, versions, and any other pertinent details.
- **Suggesting Enhancements**  
  Have an idea for improving BSManager? We welcome all suggestions—open an issue to discuss your proposal.

> [!TIP] 
> Before opening a new issue, please check if there’s already an existing one for the same topic to avoid duplicates.

---

## Submitting Pull Requests

### Before You Begin

1. **[Fork the repository][fork]** and **clone** your fork locally.  
2. **Install the required tools**. The Node version is defined by both
   [mise](https://mise.jdx.dev/) and `.nvmrc`; using mise is recommended.
   ```bash
   mise install
   ```
3. **Install project dependencies** from the lockfile:
   ```bash
   npm ci
   ```

See [Building on Linux](#building-on-linux) for the required system packages.

### Create a Dedicated Branch

Use a clear naming convention for your branch:

```bash
git checkout -b (feature|bugfix|hotfix|chore)/(short-description)(/issue-id)
```

> [!NOTE]  
> Exemple : `git checkout -b feature/update-docs/42`

### Develop and Test

> [!TIP] 
> - Follow the [style guide][style] which is using standard.
> - Keep your changes as focused as possible. If there are multiple changes you would like to make that are not dependent upon each other, consider submitting them as separate pull requests.

- Make the necessary changes on your new branch.
- Test your changes manually to ensure everything is working correctly.
- Verify that your updates do not introduce regressions or break existing functionality.

### Open a Pull Request

1. **Push** your branch to your fork.  
2. Visit the main **BSManager** repository and click “Compare & pull request” or use [this link][pr].  
3. Provide a **clear description** of your changes (the context, what problem it solves, etc.).  
4. **Submit** your pull request. A maintainer will review it and may ask for adjustments or clarifications.

---

## Building on Linux

The install, build, test, and lint commands are the same on every distribution;
only system prerequisites and the native package target differ. Node 24 is
selected from `mise.toml`/`.nvmrc`.

### Distribution prerequisites

Install the packages for your distribution, then run `mise install` and
`npm ci` from the repository root.

Fedora 44:

```bash
sudo dnf install -y binutils gcc-c++ libxcrypt-compat make python3 rpm-build
```

Build the native RPM package with:

```bash
npm run build
npx electron-builder --config electron-builder.config.js --publish never --linux rpm --x64
```

Ubuntu 24.04 / Debian-based distributions:

```bash
sudo apt update
sudo apt install -y build-essential libarchive-tools python3
```

Build the native DEB package with:

```bash
npm run build
npx electron-builder --config electron-builder.config.js --publish never --linux deb --x64
```

Arch Linux:

```bash
sudo pacman -Syu --needed base-devel libarchive libxcrypt-compat python
```

Build the native pacman package with:

```bash
npm run build
npx electron-builder --config electron-builder.config.js --publish never --linux pacman --x64
```

### Verify a change

Before submitting a pull request, run:

```bash
npm run build
npm test -- --runInBand
npm run lint
npm audit --omit=dev
```

## Useful Commands

### Development

```bash
npm start
```

> Runs the application in development mode.

### Packaging

```bash
npm run package
```

> Builds the configured Debian and RPM packages using Electron Builder. Use the
> target-specific commands under [Building on Linux](#building-on-linux) for a
> native distribution package.

For one Linux package format, replace `<deb|rpm|pacman>` below:

```bash
npm run build
npx electron-builder --config electron-builder.config.js --publish never --linux <deb|rpm|pacman> --x64
```

```bash
npm run publish
```

> Publishes the application (primarily for Windows).

```bash
npm run publish:flatpak
```

> Build a Flatpak package

## Need Help?

If you have any questions or need further assistance, feel free to **open an issue** or reach out via our [discord](https://discord.gg/uSqbHVpKdV). We appreciate any and all contributions you make to BSManager!

Thank you for your interest in making BSManager better!
