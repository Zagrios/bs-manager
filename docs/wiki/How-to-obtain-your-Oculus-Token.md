### Important

Your token is a confidential piece of information. Possession of this token allows individuals to download applications, send messages, among other actions, under your identity.

However, you might wonder why it is necessary to provide this token to BSManager. The reason is that BSManager requires the token to continue the download with Oculus. Once you've input the token, it is used exclusively to communicate with Oculus servers to verify that you are the rightful owner of the game.

## Step 1 - Install and log into the Oculus Rift app
- Get the Oculus Rift app setup from the [Meta website](https://www.oculus.com/rift/setup/)
- Install the Oculus Rift app

ℹ️ **If you bought Beat Saber from the Quest store, it won't appear in your Rift library by default. To download it with BSManager, first claim it from its store page** ℹ️ 

## Step 2 - Open developer tools

- Open Oculus app
- Open the developer tools by pressing <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>i</kbd>.

## Step 3 - Copy your Token
In the developer tools : 
- Open the `Network` tab
- Filter for `graph`
- Click on the first request
- Open the `Payload` tab
- Locate your token, it should start with `FRL`
- Select the token using your mouse and press <kbd>Ctrl</kbd> + <kbd>c</kbd> to copy it

![image](https://raw.githubusercontent.com/Zagrios/bs-manager/refs/heads/master/docs/assets/oculus-token.png)

# Known bugs
- ⁠[Nothing opens when I press `Ctrl`+`Shift`+`i`.](https://github.com/Zagrios/bs-manager/wiki/Nothing-opens-when-I-press-%60Ctrl%60%E2%80%90%60Shift%60%E2%80%90%60i%60.)﻿﻿
