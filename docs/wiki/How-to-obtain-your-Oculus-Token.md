### Important

Your token is a confidential piece of information. Possession of this token allows individuals to download applications, send messages, among other actions, under your identity.

However, you might wonder why it is necessary to provide this token to BSManager. The reason is that BSManager requires the token to continue the download with Oculus. Once you've input the token, it is used exclusively to communicate with Oculus servers to verify that you are the rightful owner of the game.

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
