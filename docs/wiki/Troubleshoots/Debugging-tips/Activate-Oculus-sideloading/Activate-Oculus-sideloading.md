Enabling Oculus sideloading allows games located outside if your Oculus library to be played on your Oculus Quest.

- **Step 1:** Start the regedit application by pressing `Win + R` and typing `regedit` in the dialog box.
- **Step 2:** Navigate to `HKEY_LOCAL_MACHINE\SOFTWARE\Wow6432Node\Oculus VR, LLC\Oculus`.
- **Step 3:** Right-click on the right panel and select `New > DWORD (32-bit) Value`.
- **Step 4:** Name the new value `AllowDevSideloaded` and set the value to `1`.

You should end up with something like this:

<div align="center">
    <img src="../wiki/Troubleshoots/Debugging-tips/Activate-Oculus-sideloading/enable-oculus-sideloading.png" alt="enable-oculus-sideloading.png" />
</div>

After completing these steps, you should be able to start Beat Saber from BSManager and play it on your Oculus Quest. If you are still having issues, please join our [Discord](https://discord.gg/uSqbHVpKdV) server for further assistance.
