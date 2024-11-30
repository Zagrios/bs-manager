# Summary

- [How to create a shortcut on Windows](#how-to-create-a-shortcut-on-windows)
    - [On desktop](#on-desktop)
    - [On task bar](#on-task-bar)
- [How to create a shortcut on Steam](#how-to-create-a-shortcut-on-steam)

## How to create a shortcut on Windows

### On desktop

1. Launch [BSManager](https://www.bsmanager.io) and select your version.
2. Click on the gear at the top right of the version.
3. Click on the **`Create a shortcut`** button.
4. Choose your launch options.
5. Click on **`Create a shortcut`**, It should now appear on your desktop.

<div align="center">
  <video src="https://github.com/Zagrios/bs-manager/assets/40648115/bfa1e97d-6392-4dec-a1fc-bb05048cf6d2" />
</div>

### On task bar

1. Open notepad and drag & drop the version shortcut you need
2. Grab the version link *`(e.g. bsmanager://launch/?version=1.34.2&versionIno=19140298416807704)` -  More info [here](https://discord.com/channels/1049624409276694588/1238363810767835136/1240945451964829747)*
3. open a new notepad and type

```bat
@echo off
start <version link>
```

4. save as .bat
5. create a shortcut to this .bat file. Edit the shortcut path to: `cmd.exe /C <shortcut path>`

## How to create a shortcut on Steam

1. In [BSManager](https://www.bsmanager.io), select the version you want to open in Steam on the left side.
2. Click the gear icon at the top right and select "Create a Shortcut." This will create a shortcut on your desktop for launching the game.
3. Open Notepad (or any other text editor), and drag and drop the shortcut file into the text editor. You will see a string of text similar to this:

```yaml
bsmanager://launch/?version=1.29.1&versionIno=3940649674381032
```

4. Copy this text and remove any spaces.

<div align="center">
    <img src="../wiki/Guides/Installation-and-updates/Create-a-shortcut/SeeTxtFile.png" alt="SeeTxtFile.png" />
</div>

5. Open Steam and add [BSManager](https://www.bsmanager.io) itself as a non-Steam game entry.
6. In your Steam library, right-click on [BSManager](https://www.bsmanager.io) -> Properties, and add the link from step 4 as a launch parameter.
7. Disable Desktop Game Theatre, and scroll down to enable "Include in VR Library" so you can launch it from your VR headset.
8. Rename this entry to whatever you want and customize the name and the icon of the shortcut if desired.

<div align="center">
    <img src="../wiki/Guides/Installation-and-updates/Create-a-shortcut/SteamShortcut.png" alt="SteamShortcut.png" />
</div>
