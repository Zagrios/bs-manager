### Important

Your token is a confidential piece of information. Possession of this token allows individuals to download applications, send messages, among other actions, under your identity.

However, you might wonder why it is necessary to provide this token to BSManager. The reason is that BSManager requires the token to continue the download with Oculus. Once you've input the token, it is used exclusively to communicate with Oculus servers to verify that you are the rightful owner of the game.

# Solution 1 - Using the Oculus app

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

<img width="500" src="https://github.com/user-attachments/assets/8499035c-4e7c-423d-914d-f35b6a3d77af">


Paste the token into BSManager or other trusted apps to manage your Beat Saber game and mods. Keep it confidential.
