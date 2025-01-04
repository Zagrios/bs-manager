> [!WARNING]  
>
> Your token is a confidential piece of information. Possession of this token allows individuals to download applications, send messages, among other actions, under your identity.
>
>However, you might wonder why it is necessary to provide this token to BSManager. The reason is that BSManager requires the token to continue the download with Oculus. Once you've input the token, it is used exclusively to communicate with Oculus servers to verify that you are the rightful owner of the game.

## Table of Contents

- [Step 1 - Install and log into the Oculus Rift app](#step-1---install-and-log-into-the-oculus-rift-app)
- [Step 2 - Open developer tools](#step-2---open-developer-tools)
- [Step 3 - Copy your Token](#step-3---copy-your-token)

# Solution 1 - Using the Oculus app

## Step 1 - Install and log into the Oculus Rift app

1. Download the Oculus Rift app setup from the [Meta website](https://www.oculus.com/rift/setup/).
2. Install the Oculus Rift app on your computer.

> [!NOTE]  
>__If you bought Beat Saber from the Quest store, it won't appear in your Rift library by default. To download it with [BSManager](https://www.bsmanager.io), first claim it from its store page.__

## Step 2 - Open developer tools

1. Open the Oculus app.
2. Open the developer tools by pressing `Ctrl` + `Shift` + `i`.

## Step 3 - Copy your Token

In the developer tools:

1. Open the __`Network`__ tab.
2. Filter for __`graph`__.
3. Click on the first request that appears.
4. Open the __`Payload`__ tab.
5. Scroll to the bottom to locate your token. It should start with __`FRL`__.
6. Select the token using your mouse and press `Ctrl` + `C` to copy it.

<div align="center">
    <img src="../wiki/Guides/Login/Get-your-oculus-token/GetYourOculusToken.png" alt="GetYourOculusToken.png" />
</div>

# Solution 2 - Using the Oculus website

## Steps

1. Log in to your Meta account at https://secure.oculus.com 
2. Open the developer tools in your web browser:
   - Chrome/Edge/Firefox: Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd> or <kbd>F12</kbd>
   - Safari: Press <kbd>Option</kbd>+<kbd>Command</kbd>+<kbd>I</kbd>
3. Go to the "Application" tab
4. Expand "Cookies" in the left sidebar 
5. Click on `https://secure.oculus.com`
6. Find the cookie named `oc_ac_at` (value starts with `OC`)
7. Copy the entire `oc_ac_at` cookie value - this is your token

<div align="center">
    <img src="../wiki/Guides/Login/Get-your-oculus-token/GetYourOculusToken.png" alt="GetYourOculusTokenBrowser.png" />
</div>

Paste the token into BSManager or other trusted apps to manage your Beat Saber game and mods. Keep it confidential.
