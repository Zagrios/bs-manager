## Table of Contents

- [How to create a shortcut on Windows](#how-to-create-a-shortcut-on-windows)
    - [On desktop](#on-desktop)
    - [On taskbar](#on-taskbar)
- [How to create a shortcut on Steam](#how-to-create-a-shortcut-on-steam)

## How to create a shortcut on Windows

### On Desktop

1. Launch [BSManager](https://www.bsmanager.io) and select your version.
2. Click on the gear icon at the top-right corner of the version.
3. Click on the __`Create a Shortcut`__ button.
4. Choose your launch options.
5. Click on __`Create a Shortcut`__. It should now appear on your desktop.

<div align="center">
    <img src="../wiki/Guides/Installation-and-updates/Create-a-shortcut/BsmShortcutInterface.png" alt="SeeTxtFile.png" />
</div>

### On Taskbar

1. Open Notepad and drag & drop the version shortcut you need.
2. Grab the version link (e.g., `bsmanager://launch/?version=1.34.2&versionIno=19140298416807704`) - More info [here](#how-to-create-a-shortcut-on-steam).
3. Open a new Notepad window and type the following:

```bat
@echo off
start <version link>
```

4. Save the file with a `.bat` extension.
5. Create a shortcut to this `.bat` file. Edit the shortcut path to: `cmd.exe /C <shortcut path>`.

## How to create a shortcut on Steam

1. Launch [BSManager](https://www.bsmanager.io) and select your version.
2. Click on the gear icon at the top-right corner of the version.
3. Click on the __`Create a Shortcut`__ button.
4. Choose your launch options.
5. Click on __`Create a Shortcut`__. It should now appear on your desktop.

<div align="center">
    <img src="../wiki/Guides/Installation-and-updates/Create-a-shortcut/SteamShortcutCheck.png" alt="SeeTxtFile.png" />
</div>
