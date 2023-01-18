<a name="readme-top"></a>

<!-- PROJECT SHIELDS -->
<!--
*** I'm using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->


<!-- TITLE -->
<div align="center">
    <a href="https://github.com/Zagrios/bs-manager">
        <img src="resources/readme/icon.svg" alt="Logo" width="250" height="250">
    </a>
    <br><br>
    <h2><b>BSManager</b></h2>
    <i>(Beat Saber Manager)</i>
    <br><br>
    <span>
        Download, manage and customize your versions of Beat Saber with a simple click!
    </span>
    <br>
    <span>
        <a href="https://github.com/Zagrios/bs-manager/issues/new?assignees=Zagrios&labels=bug&template=bug_report.md&title=%5BBUG%5D">Report Bug</a> 
        ·
        <a href="https://github.com/Zagrios/bs-manager/issues/new?assignees=Zagrios&labels=enhancement&template=feature_request.md&title=%5BAME%5D">Request Feature</a>
    </span>
</div>

<!-- BADGES -->
---
<br>
<div align="center" >
    <a href="https://github.com/Zagrios/bs-manager/stargazers"><img src ="https://img.shields.io/github/stars/Zagrios/bs-manager?style=for-the-badge" alt="Stargazers"/></a>
    <a href="https://github.com/Zagrios/bs-manager/network/members"><img src ="https://img.shields.io/github/forks/Zagrios/bs-manager?style=for-the-badge" alt="Forks"/></a>
    <a href="https://github.com/Zagrios/bs-manager/blob/master/LICENSE"><img src ="https://img.shields.io/github/license/Zagrios/bs-manager?style=for-the-badge" alt="License"/></a>
    <a href="https://github.com/Zagrios/bs-manager/graphs/contributors"><img src ="https://img.shields.io/github/contributors/Zagrios/bs-manager?style=for-the-badge" alt="Contributors"/></a>
    <a href="https://github.com/Zagrios/bs-manager/issues"><img alt="GitHub issues" src="https://img.shields.io/github/issues/Zagrios/bs-manager?style=for-the-badge"></a>
    <br>
    <a href="https://discord.gg/uSqbHVpKdV"><img src ="https://img.shields.io/badge/-DISCORD-5865f2?style=for-the-badge&logo=discord&logoColor=ffffff" alt="discord"/></a>
    <a href="https://mee6.xyz/fr/m/bsmanager"><img src ="https://img.shields.io/badge/-🥰%20Support%20BSM-EC4546?style=for-the-badge" alt="Donation"/></a>
    <a href="https://discord.gg/uSqbHVpKdV"><img src ="https://img.shields.io/badge/-Twitter-F5F8FA?style=for-the-badge&logo=Twitter" alt="Twitter"/></a>
    <br>
    [<a href="#readme-bot">go to bot</a>]
</div>

---
<!-- TABLE OF CONTENTS -->
<b>Table of Contents</b>
<ul>
    <li>
        <a href="#about-the-project">About The Project</a>
        <ul>
            <li><a href="#built-with">Built With</a></li>
            <li><a href="#contributing">Contributing</a></li>
        </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <ul>
        <li><a href="#how-to-install">How to install?</a></li>
        <li><a href="#manage-versions">Manage Versions</a></li>
        <li><a href="#customize-your-instances">Customize your instances</a></li>
        <li><a href="#install-mods">Install Mods</a></li>
        <li><a href="#install-maps">Install Maps</a></li>
        <li><a href="#one-click">One Click</a></li>
        <li><a href="#having-problems">Having problems?</a></li>
    </ul>
</ul>

<!-- ABOUT THE PROJECT -->
<div align="center">
    <h1> </h1>
    <h1><b>About The Project</b></h1>
</div>
<div>
    <a href="../../">BSManager</a> was created to unify and improve the two most used tools in the community (<a href="https://github.com/RiskiVR/BSLegacyLauncher">BS legacy launcher</a> and <a href="https://github.com/Assistant/ModAssistant">Mod Assistant</a>).
    <br><br>
    <h4><a href="../../">BSManager</a> will allow you to:</h4>
    <ul>
        <li><b>Manage instances of multiple versions</b>, designed for people who need to play on different versions or have multiple profiles for the same version.</li>
        <li><b>Download your maps in the same way</b>, in addition to that, the maps are not version dependent, so you will be able to find your maps whatever version you are using without having to transfer them.</li>
        <li><b>Install your mods in one click</b>, just like <a href="https://github.com/Assistant/ModAssistant">Mod Assistant</a>, <a href="../../">BSManager</a> will allow you to install your mods quickly and securely depending on the version you choose.</li>
        <li><b>Customize your interface</b>, we know that some of you like to customize your interfaces to the maximum. That's why <a href="../../">BSManager</a> brings you peace of mind on this point, you can change the name of the versions, their color, and you can even change the color of the logo! Of course, a dark theme has been added to protect your eyes at night.</li>
    </ul>
</div>
<br>
<div align="center">
    <img src="resources/readme/preview.png" alt="(WIP) home interface with multiple instance dl and steam & oculus.">
</div>
<br>

<!--BUILT WITH-->
<div>
    <h2><b>Built With</b></h2>
    <ul>
        <li>
            <a href="https://electron-react-boilerplate.js.org/"><img src="https://img.shields.io/badge/-Electron%20React%20Boilerplate-black?style=for-the-badge&logo=Electron" alt="Electron React Boilerplate"></a>
        </li>
        <li>
            <a href="https://github.com/SteamRE/DepotDownloader"><img src="https://img.shields.io/badge/-Depot%20Downloader-2a475e?style=for-the-badge&logo=steam" alt="Depot Downloader"></a>
        </li>
        <li>
            <a href="https://rxjs.dev/"><img src="https://img.shields.io/badge/-RxJs-purple?style=for-the-badge&logo=ReactiveX" alt="RxJs"></a>
        </li>
        <li>
            <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/-Tailwind%20CSS-white?style=for-the-badge&logo=Tailwind%20CSS" alt="TailWind CSS"></a>
        </li>
    </ul>
</div>
<br>

<!--CONTRIBUTING-->
<div>
    <h2><b>Contributing</b></h2>
</div>

<div align="center">
    <h3><b><u>Main Developer</u></b></h3>
    <br>
    <a href="https://github.com/Zagrios"><img src="https://images.weserv.nl/?url=avatars.githubusercontent.com/u/40181755?v=4&h=150&w=150&fit=cover&mask=circle&maxage=7d"></a>
    <br><br>
    <h3><b><u>Support Developer</u></b></h3>
    <br>
    <a href="https://github.com/Iluhadesu"><img src="https://images.weserv.nl/?url=avatars.githubusercontent.com/u/92525749?v=4&h=150&w=150&fit=cover&mask=circle&maxage=7d"></a>
    <a href="https://github.com/GaetanGrd"><img src="https://images.weserv.nl/?url=avatars.githubusercontent.com/u/40648115?v=4&h=150&w=150&fit=cover&mask=circle&maxage=7d"></a>
</div>
<div align="right">
    [<a href="#readme-top">Return to top</a>]
</div>
<br>

<!--USAGE-->
<div align="center">
    <h1> </h1>
    <h1><b>Usage</b></h1>
</div>

<!--HOW TO INSTALL?-->
<div>
    <h2><b>How to install?</b></h2>
    <ul>
        <li>Download the latest release from <a href="https://github.com/Zagrios/bs-manager/releases">Releases</a>.</li>
        <li>Execute the installer and <a href="../..">BSManager</a> will start itself.</li>
        <li>Once its done if you want to download a version, select a version and download it! </li>
        <li>From the version page you can choose options, launch the version, and more!</li>
</div>
<br>

<!--MANAGE VERSIONS-->
<div>
    <h2><b>Manage Versions</b></h2>
    <span>
        <a href="../../">BSManager</a> allows you to manage your versions of Beat Saber. It gives you the ability to download any version of Beat Saber as long as you have a Steam account that already owns the game. Using <a href="../../">BSManager</a>, you can easily manage and update your collection of Beat Saber versions.
    </span>
</div>
<br>
<div align="center">

https://user-images.githubusercontent.com/40648115/213008824-25cfdda3-6350-42dc-aa53-2132b4b8e838.mov
</div>

<!--CUSTOM UR INSTANCES-->
<div>
    <h2><b>Customize your instances</b></h2>
    <span>
        The tool will allow you to completely customize each of your downloadable versions, you can change the color of the icon, choose a name for the instance and finally install your mods and map according to the Beat Saber version! 
    </span>
</div>
<br>
<div align="center">

https://user-images.githubusercontent.com/40648115/213296794-74a1e20b-12dc-44ec-a67f-e25d7010bd3d.mov
</div>

<!--INSTALL MODS-->
<div>
    <h2><b>Install Mods</b></h2>
    <span>
        <a href="../../">BSManager</a> allows you to manage Beat Saber mods in a quick and easy way. It uses the BeatMod API to allow you to install, update or uninstall mods for each version of your collection. So the tool can help you manage them efficiently.
    </span>
</div>
<br>
<div align="center">

https://user-images.githubusercontent.com/40648115/213296816-bdaafc90-da76-4835-8d83-9ac6a4e1c549.mov
</div>

<!--INSTALL MAPS-->
<div>
    <h2><b>Install Maps</b></h2>
    <span>
        In addition to managing mods, the tool that allows you to manage and organize custom beatmaps existing on <a href="https://beatsaver.com">Beat Saver</a>, a popular site for sharing custom beatmaps for beat Saber. The tool allows you to view and organize your beatmaps, as well as link different versions of the game to share all your maps together. 
    </span>
</div>
<br>
<div align="center">

https://user-images.githubusercontent.com/40648115/213296838-f775fe83-866d-4764-a7d0-648dbb8ec983.mov
</div>

<!--ONE CLICK-->
<div>
    <h2><b>One Click</b></h2>
    <span>
        The "One-Click" feature of <a href="../../">BSManager</a> is an incredibly convenient tool for Beat Saber users. It allows for easy and quick installation of models for all existing versions of Beat Saber. With this system, you will no longer need to spend hours manually installing models for each specific version of Beat Saber. All you need is one simple click to install models on all versions of Beat Saber you own.
    </span>
</div>
<div align="center">

MOV COMING SOON....
</div>

<!--HAVING PROBLEMS?-->
<div>
    <h2><b>Having problems?</b></h2>
    <span>
        See the <a href="https://github.com/Zagrios/bs-manager/issues">open issues</a> for a list of known issues, from there you can create a new issue for the problem you have!  
        Otherwise you can add on to existing issues if one matches what you're encountering.
    </span>
<div align="right">
    [<a href="#readme-top">Return to top</a>]
</div>

<h1> </h1>
<a name="readme-bot"></a>
