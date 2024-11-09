import { Configuration } from "electron-builder";

const config: Configuration = {
    extraResources: [
        "./assets/jsons/bs-versions.json",
        "./assets/jsons/patreons.json",
        "./assets/proto/song_details_cache_v1.proto"
    ],
    productName: "BSManager",
    appId: "org.erb.BSManager",
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
        certificateSha1: "2164d6a7d641ecf6ad57852f665a518ca2bf960f",
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

export default config;
