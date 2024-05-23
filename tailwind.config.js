const {nextui} = require("@nextui-org/react");
const colors = require("tailwindcss/colors");

// Suppress deprecation warnings during build
delete colors.lightBlue;
delete colors.warmGray;
delete colors.trueGray;
delete colors.coolGray;
delete colors.blueGray;

module.exports = {
    darkMode: "class",
    content: ["./src/renderer/**/*.{js,jsx,ts,tsx,ejs}", "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}"],
    mode: "jit",
    plugins: [require("tailwind-scrollbar-hide"), require("tailwind-scrollbar")({ nocompatible: true }), require("tailwindcss-scoped-groups")({ groups: ["one"] }), require("ps-scrollbar-tailwind"), nextui()],
    theme: {
        colors: {
            ...colors,
            "main-color": {
                1: "#202225",
                2: "#2C2F33",
                3: "#40444b",
            },
            "light-main-color": {
                1: "#E3E5E8",
                2: "#F2F3F5",
                3: "#FFFFFF",
            },
        },
        extend: {
            keyframes: {},
            boxShadow: {
                center: "0px 0px 8px 0px",
            },
        },
    },
};
