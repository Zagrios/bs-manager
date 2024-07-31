<a name="readme-top"></a>

<!-- PROJECT SHIELDS -->
<!--
*** I'm using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->

<!--
----------------------------------------
    BSManager
----------------------------------------
-->
<div align="center">
  <a href="https://github.com/Zagrios/bs-manager">
    <img src="resources/readme/SVG/icon.svg" alt="Logo" width="250" height="250">
  </a>
  <h1><b>BSManager</b></h1>
  <p>
    Download, manage and customize your versions of <a href="https://beatsaber.com/">Beat Saber</a> with a simple click!
  </p>
  <p>
    <a
      href="https://github.com/Zagrios/bs-manager/issues/new?assignees=Zagrios&labels=bug&template=-bug--bug-report.md&title=%5BBUG%5D+%3A+">Report
      Bug</a>
    ·
    <a
      href="https://github.com/Zagrios/bs-manager/issues/new?assignees=Zagrios&labels=enhancement&template=-feat---feature-request.md&title=%5BFEAT.%5D+%3A+">Request
      Feature</a>
    ·
    <a href="https://github.com/Zagrios/bs-manager/security/policy">Report a security vulnerability</a>
  </p>
  <hr>
</div>


<!--
----------------------------------------
    BADGES
----------------------------------------
-->
<div align="center">
  <a href="https://github.com/Zagrios/bs-manager/stargazers"><img
      src="https://img.shields.io/github/stars/Zagrios/bs-manager?style=for-the-badge" alt="Stargazers" /></a>
  <a href="https://github.com/Zagrios/bs-manager/network/members"><img
      src="https://img.shields.io/github/forks/Zagrios/bs-manager?style=for-the-badge" alt="Forks" /></a>
  <a href="https://github.com/Zagrios/bs-manager/blob/master/LICENSE"><img
      src="https://img.shields.io/github/license/Zagrios/bs-manager?style=for-the-badge" alt="License" /></a>
  <a href="https://github.com/Zagrios/bs-manager/graphs/contributors"><img
      src="https://img.shields.io/github/contributors/Zagrios/bs-manager?style=for-the-badge" alt="Contributors" /></a>
  <a href="https://github.com/Zagrios/bs-manager/issues"><img alt="GitHub issues"
      src="https://img.shields.io/github/issues/Zagrios/bs-manager?style=for-the-badge"></a>
  <br>
  <a href="https://discord.gg/uSqbHVpKdV"><img
      src="https://img.shields.io/badge/-DISCORD-5865f2?style=for-the-badge&logo=discord&logoColor=ffffff"
      alt="discord" /></a>
  <a href="https://twitter.com/BSManager_"><img
      src="https://img.shields.io/badge/-Twitter-black?style=for-the-badge&logo=X" alt="Twitter" /></a> 
<a href="https://www.bsmanager.io">
  <img src="https://img.shields.io/badge/-WebSite-00649c?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAwIDEwMDAiPgogIDxnIGZpbGw9IiMzYjgyZmYiPgogICAgPHBhdGggZD0ibTYyNi43NSA0ODUuOTEgMjAuODIgMzUxLjk0YTM1LjIxIDM1LjIxIDAgMCAxLTE1LjQ5IDMxLjM2bC0xNDQuNzEgOTYuMTRoLS4wNmEzNS41NiAzNS41NiAwIDAgMS0xMS4zMSA0Ljc3IDM0Ljg1IDM0Ljg1IDAgMCAxLTIzLjUxLTIuODdMMTM2LjU4IDgwOS45YTExNS40NSAxMTUuNDUgMCAwIDEtNjMuNzUtOTYuNDlMNTIgMzYxLjQ2YTM1LjI2IDM1LjI2IDAgMCAxIDE1LjIzLTMxLjIxbDE0NS4wNS05Ni4zNmEzNS43MiAzNS43MiAwIDAgMSAxMS4yNy00LjcgMzQuODcgMzQuODcgMCAwIDEgMjMuNTEgMi44N0w1NjMgMzg5LjQyYTExNS40MSAxMTUuNDEgMCAwIDEgNjMuNzUgOTYuNDlaIi8+CiAgICA8cGF0aCBmaWx0ZXI9ImJyaWdodG5lc3MoMzAlKSIgZD0ibTYxMy43OCA0ODYuNjcgMjAuODIgMzUyYTIyLjM0IDIyLjM0IDAgMCAxLTMyLjI2IDIxLjMxTDI4Ni40IDcwMi41N0ExMDIuNDMgMTAyLjQzIDAgMCAxIDIyOS44MyA2MTdMMjA5IDI2NWEyMi4zNSAyMi4zNSAwIDAgMSAzMi4yNi0yMS4zMkw1NTcuMiA0MDEuMDVhMTAyLjQyIDEwMi40MiAwIDAgMSA1Ni41OCA4NS42MloiLz4KICA8L2c+CiAgPHBhdGggZD0iTTcxOC4yOSA3NzYuNDggNzAwIDgwNC4xOGMtNDAuNjMgMzkuNS04Ny4wNiA2Ny4yNS0xMzMuODEgOTAuNzUtODcuMzIgNDMuOS0yMDMuNjcgNzcuMTktMjQ5IDkwLjM0YTQ4IDQ4IDAgMCAxLTI2LjE3LjE2Yy02NC0xNy43Mi0xODguNjItNzItMjM2LjI4LTEyNS40OWE0LjIzIDQuMjMgMCAwIDEgNS4zLTYuNDVjMzUuNjQgMjAuODcgMTExLjIyIDU3LjY0IDE1Ni4zNyA3NC4yMiA0OS4xOCAxOC4wNiA4MS4yOSA4Ljc0IDkyLjI4LTMuMjZhNC43NyA0Ljc3IDAgMCAxIDcuMjQuMjFjMTkuNTEgMjQgMTA3LjI2IDQuNiAxNjYuNjQtMTMgNjQuMzQtMTkgMTg1Ljg1LTc2LjU2IDIzNS43Mi0xMzUuMThabS0xOTYuMiAxNTcuMzMtMTQ3LjQ1IDU1LjY4YTMuOTIgMy45MiAwIDAgMCAxLjQ0IDcuNThsNTQuNjItLjc3YTM1LjYzIDM1LjYzIDAgMCAwIDE5LTUuNzlsNzYtNDkuNTVhNCA0IDAgMCAwLTMuNjEtNy4xNVpNMjE4LjkyIDE5NS41NmMtMjEuMTQuMDctMzMuNTUgMzUuODYtMzMuMTYgODkuMDguMiAyOCAyLjU4IDkyLjc0IDQuNzkgMTQ3LjczLjIzIDUuNzEtOC4xOCA2LjQ4LTkgLjgxbC0zOC40Mi0yNzAuNzFhNC4zOCA0LjM4IDAgMCAxIDcuMTItNCA2My42MyA2My42MyAwIDAgMCAyMS45MyAxMS44NSA0LjYxIDQuNjEgMCAwIDAgNS45LTMuNzJjNC4yLTI3LjcgMTYuNjMtNTguNzQgMzcuMzUtODguNzRhNC4zNiA0LjM2IDAgMCAxIDcuNTYuNjljMTAuODYgMjMuODcgNDkgMTAzLjggOTMuMzQgMTUyLjc5YTQuNjUgNC42NSAwIDAgMS01LjYyIDcuMjJjLTM2LjU3LTE5LjM4LTgzLjAxLTQzLjAyLTkxLjc5LTQzWm0tMTUuNDcgMzg0LjhhNC41MSA0LjUxIDAgMCAxLTQuNDYtMy45MmwtMTMuODItMTA3LjI5YTQuNSA0LjUgMCAwIDEgOC45My0xLjE1bDEzLjgyIDEwNy4yOWE0LjUgNC41IDAgMCAxLTMuODkgNSAzLjg2IDMuODYgMCAwIDEtLjU4LjA3Wk01NzcuMDggNTQuNThjLTQ2Ljc5IDE1Ljg1LTExNS40NSA0MC41Ni0xNTguNzMgNjIuNzlhMzUuNSAzNS41IDAgMCAwLTE4LjU3IDI0LjUzYy0zLjk1IDE5LjQ5LTExIDU2LjA5LTE5IDEwNy4yNi0uNyA0LjQ4LTcuMzYgMy43OC03LjExLS43NWwxMC42Ni0xOTQuNzNhMy43OCAzLjc4IDAgMCAxIDcuNDYtLjY2bDMuNDkgMTQuODVhMi41NyAyLjU3IDAgMCAwIDQuNjkuNzdjNi4xOC0xMCAyMi4zNy0zMi43OSA1Ny4zMi02NWE0LjEzIDQuMTMgMCAwIDEgNi41NiA0LjcybC0zMi41NCA3Mi44OXM3OC43OC0xOS4zNyAxNDQtMzMuMDljNC4xMS0uODcgNS42OSA1LjA4IDEuNzcgNi40MloiIGZpbGw9IiNmZmYiIHN0cm9rZT0iYmxhY2siLz4KICA8ZyBmaWxsPSIjZjQ0Ij4KICAgIDxwYXRoIGZpbHRlcj0iYnJpZ2h0bmVzcyg2MCUpIHNhdHVyYXRlKDEyMCUpIiBkPSJtOTQ3LjA3IDQxMC4zNS01Ny43NSAzNDcuNzlhMzUuMTggMzUuMTggMCAwIDEtMjIuMDYgMjcuMTVsLTE2Mi40MyA2MS42NWgtLjA2YTM1LjUyIDM1LjUyIDAgMCAxLTEyLjA2IDIuMTEgMzQuODMgMzQuODMgMCAwIDEtMjIuMjktOGwtMjczLjE3LTIyMy41YTExNS40MyAxMTUuNDMgMCAwIDEtNDAuNzYtMTA4LjIybDU3Ljc1LTM0Ny44QTM1LjI1IDM1LjI1IDAgMCAxIDQzNiAxMzQuNDdsMTYyLjgzLTYxLjc5YTM1LjUxIDM1LjUxIDAgMCAxIDEyLTIuMDggMzQuODMgMzQuODMgMCAwIDEgMjIuMjkgOGwyNzMuMTkgMjIzLjUyYTExNS4zOCAxMTUuMzggMCAwIDEgNDAuNzYgMTA4LjIzWiIvPgogICAgPHBhdGggZD0iTTkzNC4yNSA0MDguMjIgODc2LjUgNzU2YTIyLjM0IDIyLjM0IDAgMCAxLTM2LjE4IDEzLjYzbC0yNzMuMTctMjIzLjVhMTAyLjQyIDEwMi40MiAwIDAgMS0zNi4xNy05Nmw1Ny43NS0zNDcuODNhMjIuMzQgMjIuMzQgMCAwIDEgMzYuMTgtMTMuNjNsMjczLjE3IDIyMy41MWExMDIuNDIgMTAyLjQyIDAgMCAxIDM2LjE3IDk2LjA0WiIvPgogIDwvZz4KICA8ZWxsaXBzZSBmaWxsPSIjZmZmIiBzdHJva2U9ImJsYWNrIiBjeD0iNzMyLjYxIiBjeT0iNDI5LjE2IiByeD0iNjIuODMiIHJ5PSIxMTAuNzMiIHRyYW5zZm9ybT0icm90YXRlKC0xNS40NSA3MzIuNzAzIDQyOS4xOTkpIi8+Cjwvc3ZnPg=="  alt="Website" /></a>
  <a href="https://www.patreon.com/bsmanager"><img
      src="https://img.shields.io/badge/-🤍%20Support%20BSM-EC4546?style=for-the-badge" alt="Donation" /></a>
</div>

<!--
----------------------------------------
    TABLE OF CONTENTS
----------------------------------------
-->
<div>
  <hr>
  <details open>
    <summary><b>Table of Contents</b></summary>
    <ul>
      <li>
        <details>
          <summary><a href="#bsmanager-your-beat-saber-assistant">BSManager: Your Beat Saber Assistant</a></summary>
          <ul>
            <li><a href="#what-is-it">What is it?</a></li>
            <li><a href="#why-use-it">Why use it?</a></li>
            <li><a href="#built-with">Built with</a></li>
            <li><a href="#how-to-install">How to install</a></li>
          </ul>
        </details>
      </li>
      <li>
        <details>
          <summary><a href="#version-management">Version Management</a></summary>
          <ul>
            <li>
              <details>
                <summary><a href="#downloading-multiple-versions">Downloading multiple versions</a></summary>
                <ul>
                  <li>via Steam account</li>
                  <li>via Oculus (PCVR) account</li>
                </ul>
              </details>
            </li>
            <li><a href="#multi-version-sharing">Multi-version Sharing</a></li>
            <li><a href="#importing-an-existing-version-of-beat-saber">Importing an existing version of Beat Saber</a>
            </li>
            <li><a href="#launch-arguments">Launch arguments</a></li>
            <li><a href="#shortcut-creation">Shortcut creation</a></li>
          </ul>
        </details>
      </li>
      <li>
        <details>
          <summary><a href="#download-and-installation">Download and Installation</a></summary>
          <ul>
            <li><a href="#maps">Maps</a></li>
            <li><a href="#playlists">Playlists</a></li>
            <li><a href="#mods">Mods</a></li>
            <li><a href="#models">Models</a></li>
          </ul>
        </details>
      </li>
      <li>
        <details>
          <summary><a href="#customization">Customization</a></summary>
          <ul>
            <li><a href="#tool">Tool</a></li>
            <li><a href="#beat-saber-instance">Beat Saber Instance</a></li>
          </ul>
        </details>
      </li>
      <li>
        <details>
          <summary><a href="#more-information">More Information</a></summary>
          <ul>
            <li><a href="#support">Support</a></li>
            <li><a href="#credits">Credits</a></li>
            <li><a href="#Contributing">Contributing</a></li>
          </ul>
        </details>
      </li>
    </ul>
  </details>
  <div align="right">
    [<a href="#readme-bot">Go to bottom</a>]
  </div>
</div>


<!--
----------------------------------------
    BSMANAGER: YOUR BEAT SABER ASSISTANT
----------------------------------------
-->
<div align="center">
  <hr>
  <h1><b>BSManager: Your Beat Saber Assistant</b></h1>
</div>


<!--
    WHAT IS IT?
----------------------------------------
-->
<div>
  <h2>What is it?</h2>
  <p><a href="https://github.com/Zagrios/bs-manager">BSManager</a> simplifies your <a href="https://beatsaber.com/">Beat
      Saber</a> experience by centralizing the management of mods, maps, and game versions in one place.</p>
</div>


<!--
    WHY USE IT?
----------------------------------------
-->
<div>
  <h2>Why use it?</h2>
  <ul>
    <li><strong>Easy</strong>: Manage and switch between different instances of <a href="https://beatsaber.com/">Beat
        Saber</a> simply.</li>
    <li><strong>Accessibility</strong>: Access a multitude of content with just a few clicks.</li>
    <li><strong>Customization</strong>: Adapt <a href="https://github.com/Zagrios/bs-manager">BSManager</a> to your
      tastes without technical hassles.</li>
  </ul>
  <b>Start your enhanced experience with <a href="https://beatsaber.com/">Beat Saber</a> and explore all the features
    offered by <a href="https://github.com/Zagrios/bs-manager">BSManager</a>!</b>
</div>

<div align="center">
  <br>
  <video src="https://github.com/Zagrios/bs-manager/assets/40648115/012b0196-74ef-4ee5-86a4-49e835612f96"/>
</div>


<!--
    BUILT WITH
----------------------------------------
-->
<div>
  <h2><b>Built With</b></h2>
  <ul>
    <li>
      <a href="https://electron-react-boilerplate.js.org/"><img
          src="https://img.shields.io/badge/-Electron%20React%20Boilerplate-black?style=for-the-badge&logo=Electron"
          alt="Electron React Boilerplate"></a>
    </li>
    <li>
      <a href="https://github.com/SteamRE/DepotDownloader"><img
          src="https://img.shields.io/badge/-Depot%20Downloader-2a475e?style=for-the-badge&logo=steam"
          alt="Depot Downloader"></a>
    </li>
    <li>
      <a href="https://rxjs.dev/"><img
          src="https://img.shields.io/badge/-RxJs-purple?style=for-the-badge&logo=ReactiveX" alt="RxJs"></a>
    </li>
    <li>
      <a href="https://tailwindcss.com/"><img
          src="https://img.shields.io/badge/-Tailwind%20CSS-white?style=for-the-badge&logo=Tailwind%20CSS"
          alt="TailWind CSS"></a>
    </li>
  </ul>
</div>


<!--
    HOW TO INSTALL
----------------------------------------
-->
<div>
  <h2><b>How to install?</b></h2>
  <ul>
    <li>Download the <a href="https://github.com/Zagrios/bs-manager/releases/latest">latest release</a> from <a
        href="https://github.com/Zagrios/bs-manager/releases">Releases</a>.</li>
    <li>Execute the installer and <a href="https://github.com/Zagrios/bs-manager">BSManager</a> will start itself.</li>
    <li>Once it's done, if you want to download a version, select a version and download it! </li>
    <li>From the version page you can choose options, launch the version, and more!</li>
  </ul>
</div>

<div align="center">
  <video src="https://github.com/Zagrios/bs-manager/assets/40648115/4215384e-eb68-40da-884c-f21df491ef75" />
</div>


<!--
----------------------------------------
    VERSION MANAGEMENT
----------------------------------------
-->
<div align="center">
  <hr>
  <h1><b>Version management</b></h1>
</div>
<div>
  <p>With <a href="https://github.com/Zagrios/bs-manager">BSManager</a>, manage your <a
      href="https://beatsaber.com/">Beat Saber</a> versions with ease, allowing the download of new versions and
    preserving
    existing ones, provided that you own the game on a Steam or Oculus (PC) account.</p>
</div>


<!--
    DOWNLOADING MULTIPLE VERSIONS
----------------------------------------
-->
<div>
  <h2>Downloading Multiple Versions</h2>
  <p><a href="https://github.com/Zagrios/bs-manager">BSManager</a> provides two authentication methods to access your
    Steam account, ensuring safe and flexible access to
    different game versions:</p>
</div>

<div align="center">
  <img src="https://github.com/Zagrios/bs-manager/assets/40648115/09d579de-8b8e-45d3-8829-21a25cc7daf8"/>
</div>

<div>
  <ul>
    <li><strong>via Steam</strong>: Use either your credentials, which will not be stored by <a
        href="https://github.com/Zagrios/bs-manager">BSManager</a> or
      <a href="https://github.com/SteamRE/DepotDownloader">DepotDownloader</a>, or opt for a quick and secure
      authentication via QR with the Steam Guard app.</li>
  </ul>
</div>

<div align="center">
  <img src="https://github.com/Zagrios/bs-manager/assets/40648115/26da3a19-a936-4e6b-b79b-a139d7bd55de" />

</div>

<div>
  <ul>
    <li><strong>via Oculus</strong>: For Oculus users, <a href="https://github.com/Zagrios/bs-manager">BSManager</a>
      requires you to retrieve a connection token by following the instructions in this guide: <a href="https://github.com/Zagrios/bs-manager/wiki/How-to-obtain-your-Oculus-Token">How to obtain your Oculus Token</a>. Once obtained, please insert it into the form.</li>
  </ul>
</div>

<div align="center">
  <img height=450 src="https://github.com/Zagrios/bs-manager/assets/40648115/3674e629-542d-4de3-b8db-b248f25126d7" />
</div>


<!--
    MULTI-VERSION SHARING
----------------------------------------
-->
<div>
  <h2>Multi-Version Sharing</h2>
  <p><a href="https://github.com/Zagrios/bs-manager">BSManager</a> facilitates the sharing of your maps, models, and
    custom files between different versions of <a
      href="https://beatsaber.com/">Beat Saber</a>. Thanks to an intuitive user interface, you can easily share
    your files from one version to another, ensuring a consistent and continuous gaming experience across all your
    installations.</p>
</div>

<div align="center">
  <video src="https://github.com/Zagrios/bs-manager/assets/40648115/ba39aceb-f55f-4e58-8386-51fcfaad4957"/> 
</div>


<!--
    IMPORTING AN EXISTING VERSION OF BEAT SABER
----------------------------------------
-->
<div>
  <h2>Importing an Existing Version of Beat Saber</h2>
  <p><a href="https://github.com/Zagrios/bs-manager">BSManager</a> allows easy importing and organizing of your existing
    versions of <a href="https://beatsaber.com/">Beat Saber</a>, enabling you to retain
    all your previously downloaded or created data while taking advantage of <a
      href="https://github.com/Zagrios/bs-manager">BSManager</a>'s management features.</p>
</div>

<div align="center">
  <video src="https://github.com/Zagrios/bs-manager/assets/40648115/cdedb951-d97a-474d-a217-2422be3919f7"/>
</div>


<!--
    LAUNCH ARGUMENTS
----------------------------------------
-->
<div>
  <h2>Launch Arguments</h2>
  <p><a href="https://github.com/Zagrios/bs-manager">BSManager</a> provides efficient management of <a
      href="https://beatsaber.com/">Beat Saber</a> launch arguments, including three predefined ones to
    enhance your gaming experience:</p>
  <ul>
    <li><strong>Oculus Mode</strong>: Launches the game directly in Oculus mode, avoiding the use of STEAM VR.</li>
    <li><strong>FPFC Mode</strong>: Enables "FPFC" mode, allowing you to control the game without using a VR
      headset.</li>
    <li><strong>Debug Mode</strong>: Activates debugging mode, generating Windows log outputs for IPA.</li>
  </ul>
  <p>You also have the freedom to add your own custom launch arguments by inserting them into "Advanced Launch" and
    separating them with a semicolon (;).</p>
</div>

<div align="center">
  <img src="https://github.com/Zagrios/bs-manager/assets/40648115/1244d49f-20e1-400c-9818-528f05cfadf5" />
</div>


<!--
    SHORTCUT CREATION
----------------------------------------
-->
<div>
  <h2>Shortcut Creation</h2>
  <p>Create shortcuts to easily access your different versions of <a href="https://beatsaber.com/">Beat Saber</a> with
    <a href="https://github.com/Zagrios/bs-manager">BSManager</a>. After selecting your
    version, go to the version settings, click on "Create a Shortcut", and then select your launch options. Thus,
    you can quickly and easily launch your preferred version of <a href="https://beatsaber.com/">Beat Saber</a> with the
    desired settings.</p>
</div>

<div align="center">
  <video src="https://github.com/Zagrios/bs-manager/assets/40648115/bfa1e97d-6392-4dec-a1fc-bb05048cf6d2" />
</div>


<!--
----------------------------------------
    DOWNLOAD AND INSTALLATION
----------------------------------------
-->
<div align="center">
  <hr>
  <h1><b>Download and Installation</b></h1>
</div>
<div>
  <p><a href="https://github.com/Zagrios/bs-manager">BSManager</a> provides centralized and organized management of
    beatmaps, mods, and models, integrating download features and sharing between <a href="https://beatsaber.com/">Beat
      Saber</a> versions.</p>
</div>

<!--
    MAPS
----------------------------------------
-->
<div>
  <h2>Maps</h2>
  <p><a href="https://github.com/Zagrios/bs-manager">BSManager</a> integrates the <a href="https://beatsaver.com">Beat
      Saver</a> API to provide you with a comprehensive list of maps downloadable directly from its interface. Moreover,
    the OneClick feature allows you to download maps with one click from various sources such as <a
      href="https://beatsaver.com">Beat Saver</a>, <a href="https://bsaber.com">BeastSaber</a>, <a
      href="https://scoresaber.com">ScoreSaber</a>, and <a href="https://www.beatleader.xyz">Beat Leader</a>. To add
    maps, simply select the desired version or the "shared" tab, then click "ADD".</p>
</div>

<div align="center">
  <video src="https://github.com/Zagrios/bs-manager/assets/40648115/3f9f9968-ac55-465e-bc28-17aebfc787ea"/>

</div>

<!--
    PLAYLISTS
----------------------------------------
-->
<div>
  <h2>Playlists</h2>
  <p>Although the playlist management interface is not yet developed, <a
      href="https://github.com/Zagrios/bs-manager">BSManager</a> offers a OneClick feature for playlists from <a
      href="https://beatsaver.com">Beat Saver</a>.</p>
</div>

<div align="center">
  <video src="https://github.com/Zagrios/bs-manager/assets/40648115/733fe6bb-c157-4c47-8a79-f8062380bcc8" />
</div>

<!--
    MODS
----------------------------------------
-->
<div>
  <h2>Mods</h2>
  <p>Manage your mods easily with <a href="https://github.com/Zagrios/bs-manager">BSManager</a>. After downloading a
    version, navigate to the "Mods" tab of the selected version to manage and install mods. <a
      href="https://github.com/Zagrios/bs-manager">BSManager</a> operates similarly to Mod Assistant and offers the same
    mods as this tool.</p>
</div>

<div align="center">
  <video src="https://github.com/Zagrios/bs-manager/assets/40648115/ca8f0727-b2dd-41f3-bbea-9bcaf61a89f1"/>

</div>

<!--
    MODELS
----------------------------------------
-->
<div>
  <h2>Models</h2>
  <p>Add and manage models simply via the corresponding tab on the desired version or by going to the "shared" tab. The
    <a href="https://modelsaber.com">Model Saber</a> API is integrated to provide easy and direct access to models
    available for <a href="https://beatsaber.com/">Beat Saber</a>.</p>
</div>

<div align="center">
  <video src="https://github.com/Zagrios/bs-manager/assets/40648115/d983b34b-9f4c-4274-aee4-4c1c03dd90d0"/>
</div>


<!--
----------------------------------------
    CUSTOMIZATION
----------------------------------------
-->
<div align="center">
  <hr>
  <h1><b>Customization</b></h1>
</div>
<div>
  <p><a href="https://github.com/Zagrios/bs-manager">BSManager</a> offers various options to customize both the tool
    itself and your <a href="https://beatsaber.com/">Beat Saber</a> instances, allowing you to create a user experience
    that is uniquely yours.</p>
</div>

<!--
    TOOL
----------------------------------------
-->
<div>
  <h2>Tool</h2>
  <p>Adjust the appearance of <a href="https://github.com/Zagrios/bs-manager">BSManager</a> to your preferences with a
    variety of customization options available in the tool's settings:</p>
  <ul>
    <li><strong>Theme</strong>: Choose between a light or dark theme, or follow the system settings for seamless integration into your work environment.</li>
    <li><strong>Color</strong>: Select your preferred primary and secondary colors using hexadecimal codes, allowing you
      to customize the visual appearance of the tool to your liking.</li>
  </ul>
</div>

<div align="center"> 
  <video src = "https://github.com/Zagrios/bs-manager/assets/40648115/d2c1b0ec-a2f5-41b5-99d5-c4c2cd34cbd4" />
</div>

<!--
    BEAT SABER INSTANCE
----------------------------------------
-->
<div>
  <h2>Beat Saber Instance</h2>
  <p>For each <a href="https://beatsaber.com/">Beat Saber</a> instance, <a
      href="https://github.com/Zagrios/bs-manager">BSManager</a> offers customization options accessible via the version
    settings and by clicking on "Edit":</p>
  <ul>
    <li><strong>Name</strong>: Name your instances in a way that distinguishes and identifies them easily when switching
      from one to another.</li>
    <li><strong>Color</strong>: Customize the appearance of your instances by choosing a specific color for each of
      them.</li>
  </ul>
</div>

<div align="center">
  <video src="https://github.com/Zagrios/bs-manager/assets/40648115/f66a2c99-770e-42ca-9a71-b1806946ad0c" />
</div>


<!--
----------------------------------------
    MORE INFORMATION
----------------------------------------
-->
<div align="center">
  <hr>
  <h1><b>More Information</b></h1>
</div>
<div>
  <p><a href="https://github.com/Zagrios/bs-manager">BSManager</a> has an active community and a support team ready to
    assist you with any questions or issues you may encounter.</p>
</div>

<!--
    SUPPORT
----------------------------------------
-->
<div>
  <h2>Support</h2>
  <p>For quick and interactive support, it is recommended to join our <a href="https://discord.gg/uSqbHVpKdV">Discord
      server</a>. For bugs or more complex issues, you can also submit an <a href="https://github.com/Zagrios/bs-manager/issues">issue on
      GitHub</a>.</p>
</div>


<!--
    CREDITS
----------------------------------------
-->
<div>
  <h2>Credits</h2>
  <ul>
    <li><a href="https://github.com/Zagrios">Zagrios</a> - Lead Developer & Founder.</li>
    <li><a href="https://github.com/Iluhadesu">Iluhadesu</a> - Co-Developer & Co-Founder, Discord Bot Developer.</li>
    <li><a href="https://github.com/GaetanGrd">GaetanGrd</a> - Co-Developer & Co-Founder, Documentation Lead.</li>
    <li><a href="https://github.com/cheddZy">cheddZy</a> - Icon Creator.</li>
  </ul>
</div>

<!--
    CONTRIBUTING
----------------------------------------
-->
<div>
  <h2>Contributing</h2>
  <p>If you'd like to contribute, check out the <a
      href="https://github.com/Zagrios/bs-manager/blob/master/CONTRIBUTING.md">contributing guide</a>.</p>
  <p>Thank you to all the people who already contributed to <a
      href="https://github.com/Zagrios/bs-manager">BSManager</a>!</p>
  <div align="center">
    <a href="https://github.com/Zagrios/bs-manager/graphs/contributors">
      <img src="https://contrib.rocks/image?repo=Zagrios/bs-manager" />
    </a>
  </div>
</div>


<!-- 
----------------------------------------
    Others
----------------------------------------
-->
<div align="right">
  [<a href="#readme-top">Return to top</a>]
  <hr>
</div>

<a name="readme-bot"></a>
