# Windows Installation

<details><summary><h2>Install a Version with Steam</h2></summary>

1. Download and install [BSManager](https://www.bsmanager.io) from [GitHub](https://github.com/Zagrios/bs-manager/releases/latest), [Nexus Mods](https://www.nexusmods.com/beatsaber/mods/18?tab=images), or the [official website](https://www.bsmanager.io).
2. Open the **`Add Versions`** interface and select the version you wish to download.
3. Choose **`Steam`** as your platform.
4. Enter your Steam credentials (ID and password) or scan the QR code using the Steam app on your phone.
5. Once logged into Steam, the download will start automatically. Please wait for it to complete.
6. When the download is finished, select the downloaded version and click the **`Launch`** button to verify that the game launches correctly.

<div align="center">
    <img src="../wiki/Guides/Installation-and-updates/Install-or-import-a-version/SteamLogin.png" alt="SteamLogin.png" />
</div>
</details>

<details><summary><h2>Install a Version with Oculus Store (PCVR)</h2></summary>

> [!IMPORTANT] 
>
> - Ensure that Beat Saber is in your **Oculus PCVR** library to enable downgrading.
> - You must run Beat Saber at least once on your computer before attempting to launch retrograde Oculus versions from [BSManager](https://www.bsmanager.io).

1. Download and install [BSManager](https://www.bsmanager.io) from [GitHub](https://github.com/Zagrios/bs-manager/releases/latest), [Nexus Mods](https://www.nexusmods.com/beatsaber/mods/18?tab=images), or the [official website](https://www.bsmanager.io).
2. Open the **`Add Versions`** interface and select the version you wish to download.
3. Choose **`Oculus Store`** as your platform.
4. Follow [this guide](Get-your-Oculus-token) to obtain your Oculus token.
5. Once logged into Oculus, the download will start automatically. Please wait for it to complete.
6. When the download is finished, select the downloaded version and click the **`Launch`** button to verify that the game launches correctly.

<div align="center">
    <img src="../wiki/Guides/Installation-and-updates/Install-or-import-a-version/OculusLogin.png" alt="OculusLogin.png" />
</div>
</details>

# Linux Installation

<details><summary><h2>Using Ubuntu, Debian (deb)</h2></summary>

<details><summary><h3>PPA Repository</h3></summary>

Refer to [bs-manager-deb](https://github.com/silentrald/bs-manager-deb).

Add the BSManager PPA repository to your system with the following commands:

```bash
curl -fsSL https://raw.githubusercontent.com/silentrald/bs-manager-deb/refs/heads/main/KEY.gpg | sudo gpg --dearmor -o /usr/share/keyrings/bs-manager.gpg
echo "deb [signed-by=/usr/share/keyrings/bs-manager.gpg] https://raw.githubusercontent.com/silentrald/bs-manager-deb/refs/heads/main ./" | sudo tee /etc/apt/sources.list.d/bs-manager.list
sudo apt update
```

Install the `bs-manager` package using `apt`:

```bash
sudo apt install bs-manager
```

</details>

<details><summary><h3>dpkg Install</h3></summary>

Download the `.deb` file from the releases page and run the following command:

```bash
dpkg -i ./bsmanager.deb
```

> [!NOTE]
> When installed using dpkg, BSManager will not automatically update to the latest version. You need to either:
>
> - Download the latest `.deb` file from the releases page; or
> - Install through the PPA repository to enable automatic updates with `sudo apt update && sudo apt upgrade`.

</details>
</details>

<details><summary><h2>Using Arch (AUR)</h2></summary>

Refer to [bs-manager-git](https://aur.archlinux.org/packages/bs-manager-git).

To install AUR packages, you need to install [yay](https://github.com/Jguer/yay).
</details>

<details><summary><h2>Using Flatpak (Universal)</h2></summary>

This method works on any Linux distribution. Ensure `flatpak` is installed on your system. If not, visit [Flatpak](https://flatpak.org/setup/) for a setup guide tailored to your distro.

After installing `flatpak`, download the `.flatpak` file from the releases page and run the following command:

```bash
flatpak install --user ./bsmanager.flatpak
```

If you encounter errors like missing packages, run the following commands to add the correct repositories:

```bash
sudo flatpak remote-add --if-not-exists --system flathub https://flathub.org/repo/flathub.flatpakrepo

# or

flatpak remote-add --if-not-exists --user flathub https://flathub.org/repo/flathub.flatpakrepo
```

</details>

# How to Import a Version

> [!IMPORTANT]  
>
> - You will need to download a version of Beat Saber yourself before you can import it.
> - The [BSManager](https://www.bsmanager.io) team provides tutorials like [this one](https://steamcommunity.com/sharedfiles/filedetails/?id=1805934840) to help you download official versions of Beat Saber. However, no team member will offer assistance for cracked versions.

1. Launch [BSManager](https://www.bsmanager.io).
2. Click the gear icon in the top-right corner of the interface.
3. Select the **`Import a Version`** option.
4. Choose the file containing the version to be imported.
5. Wait a few moments. The imported version should appear alongside the others in the version list.

<div align="center">
  <video src="https://github.com/Zagrios/bs-manager/assets/40648115/cdedb951-d97a-474d-a217-2422be3919f7" alt="ImportVersion.mov"/>
</div>
