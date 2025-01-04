> ## ⚠️ Important ⚠️
>
> Your token is a confidential piece of information. Possession of this token allows individuals to download applications, send messages, and perform other actions under your identity.
>
> You might wonder why it is necessary to provide this token to [BSManager](https://www.bsmanager.io). The reason is that [BSManager](https://www.bsmanager.io) requires the token to continue the download with Oculus. Once you've input the token, it is used exclusively to communicate with Oculus servers to verify that you are the rightful owner of the game.

## Table of Contents

- [Step 1 - Install and log into the Oculus Rift app](#step-1---install-and-log-into-the-oculus-rift-app)
- [Step 2 - Open developer tools](#step-2---open-developer-tools)
- [Step 3 - Copy your Token](#step-3---copy-your-token)

## Step 1 - Install and log into the Oculus Rift app

1. Download the Oculus Rift app setup from the [Meta website](https://www.oculus.com/rift/setup/).
2. Install the Oculus Rift app on your computer.

> 📍 **If you bought Beat Saber from the Quest store, it won't appear in your Rift library by default. To download it with [BSManager](https://www.bsmanager.io), first claim it from its store page.**

## Step 2 - Open developer tools

1. Open the Oculus app.
2. Open the developer tools by pressing `Ctrl` + `Shift` + `i`.

## Step 3 - Copy your Token

In the developer tools:

1. Open the **`Network`** tab.
2. Filter for **`graph`**.
3. Click on the first request that appears.
4. Open the **`Payload`** tab.
5. Scroll to the bottom to locate your token. It should start with **`FRL`**.
6. Select the token using your mouse and press `Ctrl` + `C` to copy it.

<div align="center">
    <img src="../wiki/Guides/Login/Get-your-oculus-token/GetYourOculusToken.png" alt="GetYourOculusToken.png" />
</div>
