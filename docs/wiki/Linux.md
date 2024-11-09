# Linux Guide

## Installation

Go to [Releases](https://github.com/Zagrios/bs-manager/releases) page and go to the latest release. Download the necessary build installer for your distro (see below).

### Universal (flatpak)

You are required to have `flatpak` installed your system. After installing that, download the `.flatpak` file in the releases and run the following command:

```bash
flatpak install ./bsmanager.flatpak
```

If you are getting errors like packages not existing, run this command so that it finds the correct packages.

```bash
sudo flatpak remote-add --if-not-exists --system flathub https://flathub.org/repo/flathub.flatpakrepo

# or

flatpak remote-add --if-not-exists --user flathub https://flathub.org/repo/flathub.flatpakrepo
```

### Ubuntu, Debian (deb)

Download the `.deb` file in the releases and run the following command:
```bash
dpkg -i ./bsmanager.deb
```

### Arch (AUR)

Refer to [bs-manager-git](https://aur.archlinux.org/packages/bs-manager-git).

To install AUR packages, you need to install [yay](https://github.com/Jguer/yay).

## Proton Setup

[Proton](https://github.com/ValveSoftware/Proton) is needed to run the Beat Saber executable under Linux. You need to download this from either from Steam or building it from their GitHub repo.

Once Proton is installed, when you open your BSManager application for the first time, it will ask you to link the _Proton Folder_. The _Proton Folder_ also verifies if the `proton` and `files/bin/wine64` binaries exists. Once set, you should be able to launch the Beat Saber (using `proton`) and install mods (using `files/bin/wine64`). You can still change the _Proton Folder_ in the **settings page** if any new version of Steam Proton is downloaded.

# Troubleshooting

## Permission denied on "bs-version.json"

<pre>
Unhandled Exception UnhandledRejection Error: EACCES: permission denied, open '/opt/BSManager/resources/assets/jsons/bs-versions.json'
</pre>

To fix this issue, the current user must have write permissions to the "bs-versions.json". To correct the permissions do command below:

```bash
chmod +002 /opt/BSManager/resources/assets/jsons/bs-versions.json

# or

chown $(whoami) /opt/BSManager/resources/assets/jsons/bs-versions.json
```

