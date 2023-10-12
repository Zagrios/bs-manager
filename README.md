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
    <img src="resources/readme/icon.svg" alt="Logo" width="250" height="250">
  </a>
  <h1><b>BSManager</b></h1>
  <p>
    Download, manage and customize your versions of Beat Saber with a simple click!
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
  <a href="https://www.patreon.com/bsmanager"><img
      src="https://img.shields.io/badge/-🥰%20Support%20BSM-EC4546?style=for-the-badge" alt="Donation" /></a>
  <a href="https://twitter.com/BSManager_"><img
      src="https://img.shields.io/badge/-Twitter-F5F8FA?style=for-the-badge&logo=Twitter" alt="Twitter" /></a>
  <hr>
</div>


<!--
----------------------------------------
    TABLE OF CONTENTS
----------------------------------------
-->
<div>
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
                  <li><a href="#via-steam">via Steam account</a></li>
                  <li><a href="#via-oculus-coming-soon">via Oculus (pc) account</a></li>
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
            <li><a href="#contributors">Contributors</a></li>
          </ul>
        </details>
      </li>
    </ul>
  </details>
  <div align="center">
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
  <code>Upload Video Here</code>
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
    <li>Execute the installer and <a href="../..">BSManager</a> will start itself.</li>
    <li>Once its done if you want to download a version, select a version and download it! </li>
    <li>From the version page you can choose options, launch the version, and more!</li>
  </ul>
</div>

<div align="center">
  <code>Upload Video Here</code>
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
  <p>With BSManager, manage your Beat Saber versions with ease, allowing the download of new versions and preserving
    existing ones, provided that you own the game on a Steam or Oculus (PC) account.</p>
</div>


<!--
    DOWNLOADING MULTIPLE VERSIONS
----------------------------------------
-->
<div>
  <h2>Downloading Multiple Versions</h2>
  <p>BSManager provides two authentication methods to access your Steam account, ensuring safe and flexible access to
    different game versions:</p>
</div>

<div align="center">
  <code>Insert Screen connexion choice here</code>
</div>

<div>
  <ul>
    <li><strong>via Steam</strong>: Use either your credentials, which will not be stored by BSManager or
      DepotDownloader, or opt for a quick and secure authentication via QR with the Steam Guard app.</li>
  </ul>
</div>

<div align="center">
  <code>Insert steam connexion interface</code>
</div>

<div>
  <ul>
    <li><strong>via Oculus</strong>: For Oculus users, BSManager uses authentication directly via the META website
      to retrieve the connection token, ensuring reliable and secure access to your account data.</li>
  </ul>
</div>

<div align="center">
  <code>Insert oculus connexion interface</code>
</div>


<!--
    MULTI-VERSION SHARING
----------------------------------------
-->
<div>
  <h2>Multi-Version Sharing</h2>
  <p>BSManager facilitates the sharing of your maps, models, and custom files between different versions of Beat
    Saber. Thanks to an intuitive user interface, you can easily share your files from one version to another,
    ensuring a consistent and continuous gaming experience across all your installations.</p>
</div>

<div align="center">
  <code>Upload Video Here</code>
</div>


<!--
    IMPORTING AN EXISTING VERSION OF BEAT SABER
----------------------------------------
-->
<div>
  <h2>Importing an Existing Version of Beat Saber</h2>
  <p>BSManager allows easy importing and organizing of your existing versions of Beat Saber, enabling you to retain
    all your previously downloaded or created data while taking advantage of BSManager's management features.</p>
</div>

<div align="center">
  <code>Upload Video / screen Here</code>
</div>


<!--
    LAUNCH ARGUMENTS
----------------------------------------
-->
<div>
  <h2>Launch Arguments</h2>
  <p>BSManager provides efficient management of Beat Saber launch arguments, including three predefined ones to
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
  <code>Insert launch arguments interface here</code>
</div>


<!--
    SHORTCUT CREATION
----------------------------------------
-->
<div>
  <h2>Shortcut Creation</h2>
  <p>Create shortcuts to easily access your different versions of Beat Saber with BSManager. After selecting your
    version, go to the version settings, click on "Create a Shortcut", and then select your launch options. Thus,
    you can quickly and easily launch your preferred version of Beat Saber with the desired settings.</p>
</div>

<div align="center">
  <code>Upload Video Here</code>
</div>






















<!-- Credits -->
<div>
  <h1><b>Credits</b></h1>
  <ul>
    <li><a href="https://github.com/Zagrios">Zagrios</a> - Founder & Lead Developer</li>
    <li><a href="https://github.com/Iluhadesu">Iluhadesu</a> - Project Team & Developpement help</li>
    <li><a href="https://github.com/GaetanGrd">GaetanGrd</a> - Project Team & Developpement help</li>
    <li><a href="https://github.com/cheddZy">cheddZy</a> - Icon creator</li>
  </ul>
</div>

<!-- Contributing -->
<br>
<!--CONTRIBUTING-->
<div>
  <h1><b>Contributing</b></h1>
  <p>
    If you'd like to contribute, check out the <a
      href="https://github.com/Zagrios/bs-manager/blob/master/CONTRIBUTING.md">contributing guide</a>
  </p>
  <p>Thank you to all the people who already contributed to BSManager!</p>
  <div>
    <a href="https://github.com/Zagrios/bs-manager/graphs/contributors">
      <img src="https://contrib.rocks/image?repo=Zagrios/bs-manager" />
    </a>
  </div>
</div>
<br>

<div align="right">
  [<a href="#readme-top">Return to top</a>]
</div>

<h1> </h1>
<a name="readme-bot"></a>
