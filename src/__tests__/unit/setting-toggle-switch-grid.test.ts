import React from "react";
import TestRenderer from "react-test-renderer";
import { SettingToogleSwitchGrid } from "renderer/components/settings/setting-toogle-switch-grid.component";
import { isCloseOnLaunchSupported } from "renderer/helpers/close-on-launch-setting.helper";
import en from "../../../assets/jsons/translations/en.json";

jest.mock("renderer/hooks/use-theme-color.hook", () => ({
    useThemeColor: jest.fn(() => ({ firstColor: "#336699" })),
}));
jest.mock("renderer/helpers/correct-text-color", () => ({
    getCorrectTextColor: jest.fn(() => "#ffffff"),
}));

describe("settings toggle accessibility", () => {
    it("keeps the Linux close-on-launch setting visible and configurable", () => {
        expect(isCloseOnLaunchSupported("linux")).toBe(true);
        expect(isCloseOnLaunchSupported("win32")).toBe(true);
        expect(isCloseOnLaunchSupported("darwin")).toBe(false);
    });

    it("uses the authorized close-on-launch description without promising focus", () => {
        const copy = en.pages.settings.advanced["close-bs-manager-on-launch"];
        const renderer = TestRenderer.create(React.createElement(SettingToogleSwitchGrid, {
            items: [{
                checked: false,
                text: copy.title,
                desc: copy.description,
            }],
        }));
        const title = renderer.root.findByType("h2");
        const description = renderer.root.findByType("p");
        const input = renderer.root.findByType("input");
        const focusIndicator = renderer.root.findAllByType("div")
            .find(element => `${element.props.className}`.includes("peer-focus-visible:ring-2"));

        expect(input.props["aria-labelledby"]).toBe(title.props.id);
        expect(input.props["aria-describedby"]).toBe(description.props.id);
        expect(title.props.id).toBeTruthy();
        expect(description.props.id).toBeTruthy();
        expect(focusIndicator).toBeDefined();
        expect(copy.description).toBe("Closes BSManager once the Beat Saber window is ready.");
        expect(`${copy.title} ${copy.description}`).not.toMatch(/focus|foreground/i);
    });
});
