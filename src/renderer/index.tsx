import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "tailwindcss/tailwind.css";
import "./index.css";
import { IpcService } from "./services/ipc.service";
import { ThemeService } from "./services/theme.service";

const launcherContainer = document.getElementById("launcher");
const oneclickDownloadMapContainer = document.getElementById("oneclick-download-map");
const oneclickDownloadPlaylistContainer = document.getElementById("oneclick-download-playlist");
const oneclickDownloadModelContainer = document.getElementById("oneclick-download-model");
const shortcutLaunchContainer = document.getElementById("shortcut-launch");

const ipc = IpcService.getInstance();
const themeService = ThemeService.getInstance();

window.onerror = (...data) => {
    logRenderError(data);
};

document.addEventListener("DOMContentLoaded", () => {
    themeService.theme$.subscribe(() => {
        if (themeService.isDark || (themeService.isOS && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
            return document.documentElement.classList.add("dark");
        }
        document.documentElement.classList.remove("dark");
    });
});

if (launcherContainer) {
    import("./windows/Launcher").then(reactWindow => {
        createRoot(launcherContainer).render(<reactWindow.default />);
    });
} else if (oneclickDownloadMapContainer) {
    import("./windows/OneClick/OneClickDownloadMap").then(reactWindow => {
        createRoot(oneclickDownloadMapContainer).render(<reactWindow.default />);
    });
} else if (oneclickDownloadPlaylistContainer) {
    import("./windows/OneClick/OneClickDownloadPlaylist").then(reactWindow => {
        createRoot(oneclickDownloadPlaylistContainer).render(<reactWindow.default />);
    });
} else if (oneclickDownloadModelContainer) {
    import("./windows/OneClick/OneClickDownloadModel").then(reactWindow => {
        createRoot(oneclickDownloadModelContainer).render(<reactWindow.default />);
    });
} else if (shortcutLaunchContainer) {
    import("./windows/ShortcutLaunch").then(reactWindow => {
        createRoot(shortcutLaunchContainer).render(<reactWindow.default />);
    });
} else {
    const root = document.getElementById("root");
    import("./windows/App").then(reactWindow => {
        createRoot(root).render(
            <HashRouter>
                <reactWindow.default />
            </HashRouter>
        );
    });
}

export function logRenderError(...params: unknown[]){
    ipc.sendLazy("log-error", { args: params });
}

export function addFilterStringLog(str: string){
    ipc.sendLazy("add-filter-string", { args: str });
}

export function addFilterPatternLog(pattern: string){
    ipc.sendLazy("add-filter-pattern", { args: pattern });
}


