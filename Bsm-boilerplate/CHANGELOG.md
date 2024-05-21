## Not released yet ~

## [1.4.3](https://github.com/Zagrios/bs-manager/releases/tag/v1.4.3) (Dec 27, 2023)

### Features
- It's now possible to save Oculus token entered manually with a password #383

### Fixes
- Fixed issue where the latest Beat Saber version was misordered #379 

### Other changes
- Re-enabled Oculus downgrade with manual token input #383 

## [1.4.2](https://github.com/Zagrios/bs-manager/releases/tag/v1.4.2) (Dec 17, 2023)

### Features
- Added Traditional Chinese translation (thanks to @mant0u0) #372

### Fixes
- Fixed an issue with keyboard navigation in the downloadable versions list [344e7ab](https://github.com/Zagrios/bs-manager/commit/344e7abc95130cfa44d9fa51365a5161c9f378a6)
- Fixed an issue where automatic Steam version detection  was not working for some users  #375

### Other changes
- Temporarily disabled Oculus downgrade #377
- Recommended version now appears first in the versions list #376 
- Updated the "Broken Models" notification #378 

## [1.4.1](https://github.com/Zagrios/bs-manager/releases/tag/v1.4.1) (Dec 5, 2023)

### Features
- Added Japanese translation (thanks to @emesan22) #365

### Fixes
- Fixed a JavaScript error that occurred when closing a window during a download #366
- Resolved text overflow issue with the Spanish translation #367
- Fixed an issue where downloading a playlist was not possible if a version do not has the "CustomLevel" folder #368
- Installing a playlist now doesn't download maps that are already present #369 

## [1.4.0](https://github.com/Zagrios/bs-manager/releases/tag/v1.4.0) (Nov 28, 2023)

### Features
- Oculus PCVR support #346 
- The most moddable version now have a “Recommended” banner #354 
- Chinese translation has been added (thanks to @ktKongTong)

### Fixes
- BSManager crashes if too many OneClick downloads are done at the same time #340
- Unable to download playlists with OneClick from some websites #349
- "Refresh list" was updating available versions but not installed versions #351
- Prevent launching a version that is currently downloading #355 
- Prioritize IPv4 to avoid IPv6 issues #353 
- Import version progress bar is now accurate #358

### Other changes
- Fix french translation misspelling and standardize the "Beat Saber" name #341 (Thanks to @Synaelle)

## [1.3.2](https://github.com/Zagrios/bs-manager/releases/tag/v1.3.2) (Oct 8, 2023)

### Fixes
- Maps or Playlists couldn't be downloaded with OneClick if maps were linked #331 #337 
- Mishandling of additional launch arguments when launching from a shortcut #335 
- Incorrect English translation #336 

## [1.3.1](https://github.com/Zagrios/bs-manager/releases/tag/v1.3.1) (Oct 2, 2023)

### Features
- Beat Saber versions now automatically sync with LIV #320
- Use ArcViewer to preview maps #312 

### Fixes
- SteamVR backup folder is now restored when disabling FPFC Mode #314 
- OneClick installs now correctly place contents in user-defined symlinks #311
- Currently downloading Beat Saber version no longer disappears on uninstalling a version #307 
- Add "no-yeet" argument when launching Beat Saber to prevent mods to be removed if "UserData" is linked #321
- Fixed a rare bug that prevent BSManager from launching due to a missing DLL #328 
- Increase the SteamVR restore timeout to prevent it from launching in FPFC Mode #330 

### Other changes
- Improved Spanish translation #309 (Thanks to @GabiRP)
- For new installations, the default folder for BSManager contents has been moved from "Documents" to the "User" directory to avoid OneDrive conflicts #319 

## [1.3.0](https://github.com/Zagrios/bs-manager/releases/tag/v1.3.0) (Aug 10, 2023)

### Features
- Steam now launches automatically if needed when starting a version of Beat Saber #255
- Create shortcuts to launch Beat Saber more quickly without going through BSManager #282
- Russian translation has been added (thanks to @Dead0Duck)
- Download Beat Saber versions without enter your credentials using QR code to login #293 
- Login approval from the Steam app is now being handled #293 

### Fixes
- Unable to delete maps from shared content #262
- Maps are no longer loaded unnecessarily when not accessing the map tab #261
- BSManager no longer crashes when it loads tons of maps #288 
- Loading maps is faster and consumes a lot less memory #288
- Prevent installed mods from being downgraded after mods installation #291
- Window title of BSManager no longer become "index.html" after closing settings #290 
- Models' texts color within the download modal in light theme is now correct #296 
- Downloading versions of Beat Saber now works on Linux #297 (thanks to @Insprill)
- Fix the ability to focus on non-visible elements #299 

### Other changes
- Corrections and adjustments of some translations for better clarity #249 #279 (Thanks to @AltyFox and @KnuckleDF)
- Improved compatibility with Linux (Thanks to @RedlineTriad and @Insprill)
- Alpha versions should now update to the latest Stable version when its available #294 

## [1.2.0](https://github.com/Zagrios/bs-manager/releases/tag/v1.2.0) (Jun 16, 2023)

### Features
- Add models management #218
- Hexadecimal field has been added in color pickers #236 
- "Show Password" button has been added in the login modal #244 

### Fixes
- Made permission error not possible when installing mods #219
- Fix progress collision when switching versions while maps are being loaded #220 
- Some mods do not show as installed after an update #231
- Some mods are not marked as updated, after a mods update #229 
- Shortcut to BSManager had an incorrect description #240 
- Mod LookupID was never shown as installed #242 
- Usernames with spaces were not supported for Steam login #243 
- Can't clone Steam version without renaming it #248 

### Other changes
- Some UI elements have been reorganized to make usage more pleasant #218 
- Initial loading of mods is now faster #232 
- A warning has been added when the Steam password exceeds 64 characters #225 

## [1.1.1](https://github.com/Zagrios/bs-manager/releases/tag/v1.1.1) (Apr 13, 2023)

### Features
- Add German translation #198 #199 (thanks @XCraftTM)
- Add message when no mods are available #197 
- Add button to link all folders at once #204 
- Add indicator when a supporter is clickable #208 

### Fixes
- Fix error with mods management when offline #202
- Can't open supporter link #207 
- Change color of diamond supporters to match the discord role color #208 
- Error when spaces are present in Steam Guard code #209 
- Unable to move contents folder of BSManager when parent folder is named "BSManager" #210 
- Unable to move contents folder of BSManager to another drive if symlinks are present #210 
- Improve resilience to errors when moving contents folder of BSManager #210 
- A strange bug prevents the launch of Beat Saber for some people #215 

### Other changes
- Add BeatLeader icon in OneClicks settings #193 

## [1.1.0](https://github.com/Zagrios/bs-manager/releases/tag/v1.1.0) (Mar 24, 2023)

### Features
- Custom folders can now be shared between BeatSaber versions #176  
- Advanced launch options to add custom launch arguments for BeatSaber #179 
- Added an indicator if the current version is a preview #185 

### Fixes
- Disable SteamVR when "Desktop Mode" is enabled #181 
- Fix some UI bugs #175 
- Reactivate support button #183 
- Installing an older version of a mod overwrites the most recent version installed #186
- On version cloning, contents of linked folders no longer duplicate #189 
- Now, the content of a shared folder is moved instead of being duplicated if no other version uses this shared folder #191 

## [1.0.4](https://github.com/Zagrios/bs-manager/releases/tag/v1.0.4) (Mar 4, 2023)

### Features
- Add volume control #154 

### Fixes
- Fix some English translations #153 #151 #167 
- The debug console does not open #158 
- Can't enable Oculus and Desktop mode in the same time #159 
- Pause Map song on open preview #160 
- Reduces map loading time by 20 to 40% depending on configuration (still work on that) #161 
- Mods menu partially hidden when no mods listed #165 
- Fix light theme issues #168 
- The .NET installation request notification sometimes does not appear #170 
- Change Oculus Mode description #166 

### Other changes
- We have added an explanation of why we need your Steam credentials to download a BeatSaber version #164 

## [1.0.3](https://github.com/Zagrios/bs-manager/releases/tag/v1.0.3) (Feb 28, 2023)

### Fixes
- Can't download Beat Saber version if there are spaces in the folder path

## [1.0.2](https://github.com/Zagrios/bs-manager/releases/tag/v1.0.2) (Feb 24, 2023)

### Fixes
- Huge RAM usage optimization in maps list #140 
- Maps deletion is way faster #140 
- Maps progress bars are now accurate #140 
- Maps loading is slightly faster #140 
- Other little optimizations for the Maps management feature #140 
- OneClick install for Maps not work if no Beat Saber version is installed #141
- Little English translation fix #143 

## [1.0.1](https://github.com/Zagrios/bs-manager/releases/tag/v1.0.1) (Feb 6, 2023)

### Fixes
- Some French translation corrections #133 
- Update the default Mods to be more consistent with ModAssistant #132 #135 
- Disable the `Support BSManager` button due to the change of the donation platform #134 

## [1.0.0](https://github.com/Zagrios/bs-manager/releases/tag/v1.0.0) (Jan 26, 2023)

### Breaking Change

- Config file have been moved to contents folder of BSManager to keep user config even if it exports the contents folder to another pc #55
- Versions file system have been modified to be more reliable #118 

### Features

- Maps Management #35 
- OneClick installs (maps, playlists, models) #35
- Oculus BeatSaber detection #17 
- Lunch Steam from BSManager #37 
- Alert if dotnet is not installed #54 
- Swipe notification to close it #40 
- Add discord button in settings #46 
- Add Mods disclaimer #50 
- Some UI tweaks #39 #51
- Moving from Patreon to Mee6 #86 
- Add launch mod infos #11 
- Can import external BeatSaber installs #121
- Add Web installer

### Fixes

- Outdated mod not seen as outdated #36 
- Settings close button was stuck when scrolling #85 
- Error when try to loading mods without internet #87 
- Can't manage any version if Oculus app is not installed #101 
- Download version button overlap with the spin loader #99 
- After uninstall last BeatSaber version we stay on the same page #105 
- No more files verification in available versions list #126 

### Other Changes

- Fix high CPU usage #121 

## [0.2.0](https://github.com/Zagrios/bs-manager/releases/tag/v0.2.0) (Oct 23, 2022)

### Features

-   Mods management fully implementd [5c47897](https://github.com/Zagrios/bs-manager/commit/5c478979e96b14dd54a3889e551c163ece701b4a)
-   Add close button in settings page #5
-   Add GitHub and contribution actions in settings page #3

### Fixes

-   Lunch Beat Saber multiple times #1
-   Placeholders and some texts not with light theme #6
-   Wrong background color when version is downloading #7
-   Add missing translations [5817260](https://github.com/Zagrios/bs-manager/commit/58172606f3f4731c90c9aa838fb89ac95458e032)
-   Error when loading downloaded versions when Steam is not installed [6e07adb](https://github.com/Zagrios/bs-manager/commit/6e07adb990f78073dd68c2b9cf6209562bb4bf2b)

## [0.1.0](https://github.com/Zagrios/bs-manager/releases/tag/v0.1.0) (September 19, 2022)

-   Initial public release
