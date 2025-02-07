# Contributing to BS-Manager

[code-of-conduct]: CODE_OF_CONDUCT.md
[fork]: https://github.com/Zagrios/bs-manager/fork
[pr]: https://github.com/Zagrios/bs-manager/compare
[style]: https://github.com/basarat/typescript-book/blob/master/docs/styleguide/styleguide.md

Hello! We’re delighted that you’re interested in contributing to **BS-Manager**. Your help is essential to maintaining and improving this project.

> [!NOTE]  
> This project is released with a [Contributor Code of Conduct][code-of-conduct]. By participating, you agree to abide by its terms.

---

## Opening Issues

- **Reporting Bugs**  
  If you find a bug or any unexpected behavior, feel free to open an issue. Be sure to include steps to reproduce it, relevant logs, versions, and any other pertinent details.
- **Suggesting Enhancements**  
  Have an idea for improving BS-Manager? We welcome all suggestions—open an issue to discuss your proposal.

> [!TIP] 
> Before opening a new issue, please check if there’s already an existing one for the same topic to avoid duplicates.

---

## Submitting Pull Requests

### Before You Begin

1. **[Fork the repository][fork]** and **clone** your fork locally.  
2. **Install the required Node.js version** (we recommend using [Volta](https://volta.sh/) to manage Node versions).  
3. **Install project dependencies**:
   ```bash
   npm install
   ```

### Create a Dedicated Branch

Use a clear naming convention for your branch:

```bash
git checkout -b (feature|bugfix|hotfix|chore)/(short-description)(/issue-id)
```

> [!NOTE]  
> Exemple : `git checkout -b feature/update-docs/42`

### Develop and Test

- Make the necessary changes on your new branch.
- Test your changes manually to ensure everything is working correctly.
- Verify that your updates do not introduce regressions or break existing functionality.

### 2.4 Open a Pull Request

1. **Push** your branch to your fork.  
2. Visit the main **BS-Manager** repository and click “Compare & pull request” or use [this link][pr].  
3. Provide a **clear description** of your changes (the context, what problem it solves, etc.).  
4. **Submit** your pull request. A maintainer will review it and may ask for adjustments or clarifications.

---

## 3. Useful Commands

### Development

```bash
npm start
```

> Runs the application in development mode.

### Packaging

```bash
npm run package  
```

> Packages the application using Electron Builder.

```bash
npm run build && electron-builder --config electron-builder.config.js --publish never --x64 --linux <deb/rpm/pacman>
```

> Package for Linux distros (deb, rpm, pacman)

```bash
npm run publish
```

> Publishes the application (primarily for Windows).

```bash
npm run publish:flatpak
```

> Build a Flatpak package

## Need Help?

If you have any questions or need further assistance, feel free to **open an issue** or reach out via the project’s communication channels. We appreciate any and all contributions you make to BS-Manager!

Thank you for your interest in making BS-Manager better!
