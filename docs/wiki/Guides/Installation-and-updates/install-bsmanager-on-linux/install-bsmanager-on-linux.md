## Table of Contents

- [Installation](#installation)
    - [Ubuntu, Debian (deb)](#ubuntu-debian-deb)
        - [PPA Repository](#ppa-repository)
        - [dpkg Install](#dpkg-install)
    - [Arch (AUR)](#arch-aur)
    - [Universal (flatpak)](#universal-flatpak)
- [Proton Setup](#proton-setup)

## Installation

Go to [Releases](https://github.com/Zagrios/bs-manager/releases) page and go to the latest alpha release (version 1.5.0-alpha.5 or higher). Download the necessary build installer for your distro (see below).

### Ubuntu, Debian (deb)

#### PPA Repository

Refer to [bs-manager-deb](https://github.com/silentrald/bs-manager-deb).

Add the BSManager PPA repository into your system with the following commands.

```bash
curl -fsSL https://raw.githubusercontent.com/silentrald/bs-manager-deb/refs/heads/main/KEY.gpg | sudo gpg --dearmor -o /usr/share/keyrings/bs-manager.gpg
echo "deb [signed-by=/usr/share/keyrings/bs-manager.gpg] https://raw.githubusercontent.com/silentrald/bs-manager-deb/refs/heads/main ./" | sudo tee /etc/apt/sources.list.d/bs-manager.list
sudo apt update
```

Install the `bs-manager` package using `apt`.

```bash
sudo apt install bs-manager
```

#### dpkg install

Download the `.deb` file in the releases and run the following command:

```bash
dpkg -i ./bsmanager.deb
```

**NOTE:** When installed using dpkg, BSManager will not automatically update to the latest version. You have to either:

- Download the latest `.deb` file on the Releases page; or
- Install thru PPA repository to automatically update with `sudo apt update & sudo apt upgrade`.

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

## Missing Icons in game



## Permission denied on "bs-versions.json"



## [deb] The SUID sandbox helper binary was found



## [Flatpak] Steam Beat Saber version not showing / Proton not detected



## [Flatpak] Changing installation folder


