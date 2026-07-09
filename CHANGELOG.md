## Not released yet ~
[PR Merged since the last release](https://github.com/Zagrios/bs-manager/pulls?q=is%3Apr+is%3Amerged+merged%3A%3E2025-02-03)\
[PR Merged since the last alpha](https://github.com/Zagrios/bs-manager/pulls?q=is%3Apr+is%3Amerged+merged%3A%3E2025-02-03)

## [1.5.2](https://github.com/Zagrios/bs-manager/releases/v1.5.2) (Feb 3, 2025)

### Fixes
- Fixed an issue where BSManager was unable to load mods #786 

## [1.5.1](https://github.com/Zagrios/bs-manager/releases/v1.5.1) (Jan 31, 2025)

### Fixes
- Fixed an issue where playlist files were wiped when linking the playlist folder #769 (Thanks to @silentrald)
- Fixed missing translations when deleting duplicate maps #774

### Other changes
- Added more logs for file and folder manipulations #772 (Thanks to @silentrald)

## [1.5.0](https://github.com/Zagrios/bs-manager/releases/v1.5.0) (Jan 30, 2025)

### Features
- A notification for outdated mods now appears when navigating to a Beat Saber version #755
- Added Brazilian Portuguese translation #751 (Thanks to @arthurmluz)
- Advanced launch arguments now accept environment variables #749 (Thanks to @silentrald)
- Added the ability to create shortcuts in the Steam library to launch different versions of Beat Saber #731 
- Added Italian translation #721 (Thanks to @Davitekk)
- Added the ability to log in directly with Meta within BSManager to download Beat Saber #716 
- Added an advanced setting on Windows to use the system proxy #704 (Thanks to @GoldJohnKing)
- Added an advanced launch option to skip starting Steam before launching Beat Saber #664 (Thanks to @LiamillionSS)
- You can now filter maps by leaderboard (Beatleader/ScoreSaber/All) #623 (Thanks to @silentrald)
- BSManager now goes to the latest launched version page on startup #603 (Thanks to @silentrald)
- Drag and drop your mods to install them #575 (Thanks to @silentrald)
- Added Korean translation #641 (Thanks to @izunya)
- Drag and drop your maps to import them #575 (Thanks to @silentrald)
- Added playlist support #503
- Added Linux support (Thanks to @silentrald and @Insprill) 
- Added reset button to reset values when editing a Beat Saber version #438 (Thanks to @Liborsaf)
- You can now choose to install only needed mods or reinstall all mods #540
- The installation location for contents downloaded by BSManager is now asked after the installation of BSManager or when the previous location can no longer be accessed #566 (Thanks to @silentrald)
- Added an advanced setting to disable hardware acceleration for BSManager #572
- Added an advanced setting to use symlinks instead of junctions #572

### Fixes
- Fixed an issue where, under certain conditions, BSManager could crash if an error occurred while downloading Beat Saber from Steam #722 (Thanks to @silentrald)
- Fixed an issue where switching between Beat Saber versions too quickly displayed mods for the wrong version #472
- Fixed an issue where the launch window from a shortcut would never close #485
- Advanced launch arguments are used even when the input field is closed #496
- Fixed an issue where having many maps caused some maps to not have their information loaded #503
- Fixed an issue where downloading maps sometimes resulted in a timeout error #524
- Fixed an issue where the duration of maps could be wrong in some cases #522
- Fixed missing styles on the "add" and "setting" buttons in the nav bar #530 
- Fixed an issue where switching between two Beat Saber versions didn't clear the selected content of the previous version #557
- Fixed a potential crash when BeatMods cloud contained invalid mod dependencies #558
- Fixed an issue where the folder location for the contents downloaded by BSManager could not be changed if the previous location was unreachable #566 (Thanks to @silentrald)

### Other changes
- A new log file is now created each time BSManager is launched #750 (Thanks to @silentrald)
- The advanced launch panel has been completely reworked #709 
- Link and Unlink modals have been reworked to provide more detailed information to users #699 
- Some folders are now blacklisted to prevent issues caused by linking incorrect folders #691 (Thanks to @silentrald)
- .NET Framework is no longer required #489
- Clear English translations for the Steam credentials popup #476 (Thanks to @Aeywoo)
- NSFW models are now blurred when browsing for models #493
- If map stars are unavailable, NPS or NJS of the map is now used to indicate its difficulty #553 
- When no mods are available for a Beat Saber version, the version number is now shown #507
- After a first full maps loading, maps loads almost instantly #503
- Improved performance in lists with lot of contents #503
- Improved German translation #559 (Thanks to @kgabriel-dev)
- Updated the icon for the button to un-maximize the BSManager window #562 (Thanks to @joriskleiber)

## [1.4.18](https://github.com/Zagrios/bs-manager/releases/v1.4.18) (Jan 18, 2025)

### Fixes
- Fixed an issue where enabling Oculus sideloading was not working if BSManager installation path contained spaces #735 
- The IPA folder is now cleared each time BSIPA is installed to prevent potential crashes caused by conflicts with old BSIPA files #746 
- Added a check to ensure the file system supports symlinks before moving contents to the shared folder #739 

### Other changes
- Events occurring in `bs-admin-start.exe` and `oculus-allow-dev-sideloaded.exe` are now logged #735

## [1.4.17](https://github.com/Zagrios/bs-manager/releases/v1.4.17) (Jan 2, 2025)

### Fixes
- Fixed an issue where original Steam installations of Beat Saber did not have any mods available
- Mod descriptions should no longer contain HTML tags

## [1.4.16](https://github.com/Zagrios/bs-manager/releases/v1.4.16) (Jan 2, 2025)

### Fixes
- Fixed infinite mod loading when a mod file could not be found on BeatMods #725 (Thanks to @silentrald)
- Fixed an issue where no mods were shown as installed when a mod dependency could not be found #726 (Thanks to @silentrald)
- Fixed minor UI issues

## [1.4.15](https://github.com/Zagrios/bs-manager/releases/v1.4.15) (Jan 2, 2025)

### Fixes
- Use the sideloading feature of Oculus to prevent errors when launching Oculus versions of Beat Saber #720
- Oculus token starting with `OC` are now accepted

### Other changes
- Mods now load faster #508 
- Switched to the new BeatMods API for loading mods


## [1.4.14](https://github.com/Zagrios/bs-manager/releases/v1.4.14) (Dec 2, 2024)

### Fixes
- Fixed an issue where downloading private playlists through OneClick was always resulting in an error #679 (Thanks to @Top-Cat)
- Beat Saber file verification was broken due to an error in DepotDownloader #677


## [1.4.13](https://github.com/Zagrios/bs-manager/releases/v1.4.13) (Nov 26, 2024)

### Features
- Added the possibility to unselect all mods from the mods panel #666

### Fixes
- Fixed an issue where downloading maps with subfolders was not possible #649 (Thanks to @silentrald)
- Corrected the mods search bar color in the light theme #660 (Thanks to @chk1)

### Other changes
- Added the BeatLeader icon to the OneClick playlist settings #653
- A warning now appears before downloading an outdated BeatSaber version #654
- Oculus BeatSaber versions no longer launch if the Oculus library is not found #657 (Thanks to @LiamillionSS)
- Maps from BeatSaver are now sorted by relevance by default #662 (Thanks to @Top-Cat)
- Removed the `--no-yeet` argument when launching original copies of BeatSaber #667
- Added warnings for outdated versions in the versions view #673 


## [1.4.12](https://github.com/Zagrios/bs-manager/releases/v1.4.12) (Nov 6, 2024)

### Fixes
- Fixed OneClick playlist download that has been broken in the previous release #645 
- Fixed an issue where downloading playlists could fail if the playlist's file contained special characters #645 

## [1.4.11](https://github.com/Zagrios/bs-manager/releases/v1.4.11) (Nov 4, 2024)

### Fixes
- BSManager was not working if the path to BSM's installation folder contained URL special characters #636 
- Linking folders was no longer working if the folders contained files
- Under certain conditions, loading maps could result in a black screen

### Other changes
- The "Broken Models" notification has been removed #640 


## [1.4.10](https://github.com/Zagrios/bs-manager/releases/v1.4.10) (Oct 27, 2024)

### Fixes
- Mods using a manifest file were sometimes not detected as installed #564
- BSIPA installation was always considered as successfull even if an error occured #511
- Some map filter tags were no longer working #619 (Thanks to @silentrald)
- Fixed an issue where, under certain conditions, linking a folder could result in the loss of its contents #568 

### Other changes
- Default mods are no longer reselected when mods are already installed #535 
- The `DLC` folder has been removed from the default list of folders that can be linked #628 
- The naming scheme for downloaded maps and playlists has been updated to prevent duplicates when downloading maps or playlists from Beat Saber or other tools


## [1.4.9](https://github.com/Zagrios/bs-manager/releases/v1.4.9) (Oct 15, 2024)

### Fixes
- Updated DepotDownloader dependency to fix connection errors with Steam

### Other changes
- Added support for `info.dat` v4


## [1.4.8](https://github.com/Zagrios/bs-manager/releases/v1.4.8) (Aug 1, 2024)

### Other changes
- Added checks to avoid logging sensitive data in log files
- The oldest log files are deleted to retain a maximum of 5 log files


## [1.4.7](https://github.com/Zagrios/bs-manager/releases/v1.4.7) (Mar 13, 2024)

### Fixes
- Fixed being unable to download models with BSManager #436 

### Other changes
- Fixed a typo in german translation (Thanks to @fllppi)

## [1.4.6](https://github.com/Zagrios/bs-manager/releases/v1.4.6) (Mar 6, 2024)

### Features
- It's now possible to exclude already installed maps when downloading maps from BSManager #426 (Thanks to @Liborsaf)

### Fixes
- Fixed an issue where BSManager couldn't get path to user's documents under certain conditions, preventing any action from the user #431
- To prevent the last launched Beat Saber version getting wiped by Oculus auto-updates, the symlink  created to launch the version is now deleted after the game stops #432

## [1.4.5](https://github.com/Zagrios/bs-manager/releases/v1.4.5) (Feb 12, 2024)

### Fixes
- Fixed an issue preventing launching downgraded Steam versions under certain conditions #415 
- Fixed an issue preventing launching downgraded Oculus versions under certain conditions #421
- Fixed an issue where SteamVR was not properly restored after launching Beat Saber from a shortcut with FPFC mode #417 (Thanks to @slinkstr)

## [1.4.4](https://github.com/Zagrios/bs-manager/releases/v1.4.4) (Feb 1, 2024)

### Fixes
- When launching an Oculus Beat Saber version, the Oculus app is also started if needed to avoid crashes #405 
- If Steam is running as admin, Beat Saber is now also started as admin to avoid crashes #404 
- Fixed the issue where BSManager could fail to start due to a missing DLL #400 
- Fixed the issue where BSManager could not locate the Oculus library #398 

### Other changes
- Added some tooltips to the maps UIs #397 
- Updated the maps panel UI for consistency with the rest of BSManager UIs #399 

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
