# Configure the OpenXR Runtime

Recent versions of Beat Saber use OpenXR. Windows has one active OpenXR runtime; it determines whether an OpenXR game runs through SteamVR, Meta Quest Link/Oculus, or Virtual Desktop's VDXR.

The selected runtime is a Windows-wide setting and applies to every OpenXR application. After changing it, restart the VR application and reconnect the headset before launching Beat Saber.

> Your store does not choose the runtime. A Steam copy of Beat Saber can be played through Meta Quest Link or Virtual Desktop, and an Oculus/Meta copy can be played through SteamVR when the game supports OpenXR.

## Use SteamVR

Choose **SteamVR** when you want to play through SteamVR, for example when using Steam Link.

1. Start SteamVR.
2. In the SteamVR desktop window, open the menu in the top-left corner and select **Settings**.
3. Select the **OpenXR** tab.
4. Click **Set SteamVR as OpenXR Runtime**.
5. Restart SteamVR, reconnect the headset, then launch Beat Saber.

<div align="center">
    <img src="../wiki/Troubleshoots/Debugging-tips/Configure-OpenXR-Runtime/Set-SteamVR-as-active-OpenXR-Runtime.png" alt="SteamVR settings showing Set SteamVR as OpenXR Runtime" />
</div>

## Use Meta Quest Link/Oculus

Choose **Meta Quest Link/Oculus** when you want to play through Quest Link or Air Link using the Meta/Oculus runtime.

1. Start the Meta Quest Link desktop application (called **Oculus** in older versions).
2. Open **Settings** from the left sidebar.
3. Select the **General** tab.
4. In the **OpenXR Runtime** section, click **Set Meta Quest Link as active** or **Set Oculus as active**.
5. Restart Meta Quest Link/Oculus, reconnect the headset, then launch Beat Saber.

<div align="center">
    <img src="../wiki/Troubleshoots/Debugging-tips/Configure-OpenXR-Runtime/Set-Oculus-as-active-OpenXR-Runtime.png" alt="Meta Quest Link settings showing Set Oculus as active" />
</div>

## Use Virtual Desktop (VDXR)

Choose **VDXR** when you are connected through Virtual Desktop and want to use its native OpenXR runtime instead of SteamVR.

1. Open **Virtual Desktop Streamer** on your PC.
2. Select **Options**.
3. Under **OpenXR Runtime**, select **VDXR**. Recent versions may select it automatically, but choosing it explicitly avoids ambiguity.
4. Reconnect the headset in Virtual Desktop, then launch Beat Saber.

<div align="center">
    <img src="../wiki/Troubleshoots/Debugging-tips/Configure-OpenXR-Runtime/Set-VDXR-as-active-OpenXR-Runtime.png" alt="Virtual Desktop Streamer options showing VDXR as the OpenXR Runtime" />
</div>

## OpenXR runtime and Oculus Mode are different

The active OpenXR runtime is a Windows-wide setting. BSManager's **Oculus Mode** is a launch option for a Steam instance that starts Beat Saber with `-vrmode oculus`, bypassing SteamVR.

Changing Oculus Mode does **not** change the active OpenXR runtime. Choose the runtime that matches the VR platform you are using, then use Oculus Mode only when you intentionally want to bypass SteamVR.

If Beat Saber still does not launch in VR after changing the runtime, restart the PC and try again.
