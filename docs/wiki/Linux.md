# Linux Guide

## Installation

Go to [Releases](https://github.com/Zagrios/bs-manager/releases) page and go to the latest release. Download the necessary build installer for your distro (see below).

### Ubuntu, Debian

Install the `.deb` build and run the following command:
```bash
apt install bsmanager.deb
```

### CentOS, Fedora

Install the `.rpm` build and run the following command:
```bash
rpm -i bsmanager.rpm
```

### Arch, Manjaro

Install the `.pacman` build and run the following command:
```bash
pacman -U bsmanager.pacman
```

## Proton Setup

[Proton](https://github.com/ValveSoftware/Proton) is needed to run the Beat Saber executable under Linux. You need to download this from either from Steam or building it from their GitHub repo.

Once Proton is installed, when you open your BSManager application for the first time, it will ask you to link the _Proton Folder_ so that it can access the `proton` binary inside it. This will also check if the folder you've selected is valid or not. You can also change this in the future by going to the **settings page** and search for the _Proton Folder_.

## Wine Install [Optional]

[Wine](https://www.winehq.org/) is a tool to run windows application under Linux. BSManager uses to run [BSIPA](https://nike4613.github.io/BeatSaber-IPA-Reloaded/) so that you can play Beat Saber with mods. You can install `wine` depending on your package manager. If you don't install it, this will just fallback to using the `wine` executable found in your _Proton Folder_.

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

