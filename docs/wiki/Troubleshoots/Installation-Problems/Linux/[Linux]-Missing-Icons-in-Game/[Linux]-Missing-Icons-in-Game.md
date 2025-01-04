<p align="center">
    <img src="../wiki/Troubleshoots/Installation-Problems/Linux/[Linux]-Missing-Icons-in-Game/linux-missing-icons.png" alt="Linux Missing Icons" width="300"/>
    <br>
    NOTE: "?" are missing unicode icons
</p>

This is due to [BSML](https://github.com/monkeymanboy/BeatSaberMarkupLanguage) using a missing font (`Segoe UI Symbols`) for unicode emojis.

To fix the issue, you need to get a copy of `seguisym.ttf` from the fonts folder an official copy Windows. Once you have a copy, add the font file to `~/.steam/steam/steamapps/compatdata/620980/pfx/drive_c/windows/Fonts`.
