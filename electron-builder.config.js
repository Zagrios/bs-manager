const config = {
    extraResources: [
        "./assets/jsons/bs-versions.json",
        "./assets/jsons/patreons.json",
        "./assets/proto/song_details_cache_v1.proto"
    ],
    productName: "BSManager",
    appId: "io.bsmanager.bsmanager",
    asarUnpack: "**\\*.{node,dll}",
    files: [
        "dist/**/*",
        "node_modules",
        "package.json"
    ],
    afterSign: ".erb/scripts/notarize.js",
    afterPack: ".erb/scripts/after-pack.js",
    win: {
        signingHashAlgorithms: ["sha256"],
        target: [
            "nsis",
            "nsis-web"
        ],
        icon: "./build/icons/win/favicon.ico",
        extraResources: [
            "./build/icons/win",
            "./assets/scripts/*.exe"
        ],
    },
    linux: {
        target: [
            "deb",
        ],
        icon: "./build/icons/png",
        category: "Utility;Game;",
        extraResources: [
            "./build/icons/png",
            "./assets/scripts/DepotDownloader"
        ],
        protocols: {
            name: "BSManager",
            schemes: [
                "bsmanager",
                "beatsaver",
                "bsplaylist",
                "modelsaber",
                "web+bsmap",
            ],
        },
    },
    deb: {
        fpm: ["--after-install=build/after-install.sh"],
    },
    flatpak: {
        // Version of org.electronjs.Electron2.BaseApp
        baseVersion: "24.08",
        // Version of org.freedesktop.Platform
        runtimeVersion: "24.08",
        finishArgs: [
            // Wayland/X11 Rendering
            "--socket=wayland",
            "--socket=x11",
            "--share=ipc",
            // Open GL
            "--device=dri",
            // Audio output
            "--socket=pulseaudio",
            // Read/write home directory access
            "--filesystem=~/BSManager:create", // Default BSManager installation folder
            "--filesystem=~/.steam/steam/steamapps:ro", // for the libraryfolders.vdf
            "--filesystem=~/.steam/steam/steamapps/common:create", // Steam game folder
            "--filesystem=~/.steam/steam/steamapps/common/Beat Saber:create", // For installing mods/maps to original Beat Saber version
            // Allow BSManager to create the compat folder if it does not exist
            "--filesystem=~/.steam/steam/steamapps/compatdata/620980:create",
            // Allow communication with network
            "--share=network",
            // System notifications with libnotify
            "--talk-name=org.freedesktop.Notifications",
            "--talk-name=org.freedesktop.Flatpak",
        ]
    },
    directories: {
        app: "release/app",
        buildResources: "assets",
        output: "release/build",
    },
    publish: {
        provider: "github",
        owner: "Zagrios",
    },
    fileAssociations: [
        {
            ext: "bplist",
            description: "Beat Saber Playlist (BSManager)",
            icon: "./assets/bsm_file.ico",
            role: "Viewer",
        },
    ],
};

module.exports = config;
