# Linux Guide

## Installation

Go to [Releases](https://github.com/Zagrios/bs-manager/releases) page and go to the latest release. Download the necessary build installer for your distro (see below).

### Ubuntu, Debian (deb)

Download the `.deb` file in the releases and run the following command:
```bash
dpkg -i ./bsmanager.deb
```

### Arch (AUR)

Refer to [bs-manager-git](https://aur.archlinux.org/packages/bs-manager-git).

To install AUR packages, you need to install [yay](https://github.com/Jguer/yay).

### Universal (flatpak)

This should work on any linux distribution. You are only required to have `flatpak` installed in your system. If it is not installed, then go to [flatpak](https://flatpak.org/setup/) to look for a guide on how to install it on your distro.

After installing, download the `.flatpak` file in the releases and run the following command:

```bash
flatpak install --user ./bsmanager.flatpak
```

If you are getting errors like packages not existing, run the command below so that it finds the correct packages.

```bash
sudo flatpak remote-add --if-not-exists --system flathub https://flathub.org/repo/flathub.flatpakrepo

# or

flatpak remote-add --if-not-exists --user flathub https://flathub.org/repo/flathub.flatpakrepo
```

Flatpak also supports sandboxing which gives the minimal access to your machine. To configure this, you can download [Flatseal](https://flathub.org/apps/com.github.tchx84.Flatseal) which has a GUI to edit your permissions. You can also this with the `flatpak` executable but it will not be discussed here.

## Proton Setup

[Proton](https://github.com/ValveSoftware/Proton) is needed to run the Beat Saber executable under Linux. You need to download this from either from Steam or building it from their GitHub repo.

Once Proton is installed, when you open your BSManager application for the first time, it will ask you to link the _Proton Folder_. The _Proton Folder_ also verifies if the `proton` and `files/bin/wine64` binaries exists. Once set, you should be able to launch the Beat Saber (using `proton`) and install mods (using `files/bin/wine64`). You can still change the _Proton Folder_ in the **settings page** if any new version of Steam Proton is downloaded.

# Troubleshooting

## Permission denied on "bs-versions.json"

<pre>
Unhandled Exception UnhandledRejection Error: EACCES: permission denied, open '/opt/BSManager/resources/assets/jsons/bs-versions.json'
</pre>

To fix this issue, the current user must have write permissions to the "bs-versions.json". To correct the permissions do command below:

```bash
chmod +002 /opt/BSManager/resources/assets/jsons/bs-versions.json

# or

chown $(whoami) /opt/BSManager/resources/assets/jsons/bs-versions.json
```

## [Flatpak] Steam Beat Saber version not showing / Proton not detected

Flatpak should have permissions with the steam games folder. By default, the minimum permissions are `~/.steam/steam/steamapps/common:ro` and `~/.steam/steam/steamapps/common:ro`. If you changed the steam installation path, add that path instead into the permissions.

## [Flatpak] Changing installation folder

To change the installation path of the **BSManager** folder, you have to edit the flatpak permissions to destination folder.
- In flatpak or Flatseal, add the destination folder with `:create` permissions.
- In BSM, move the folder to the destination folder.
- [Optional] In flatpak or Flatseal, remove the original folder permissions.

