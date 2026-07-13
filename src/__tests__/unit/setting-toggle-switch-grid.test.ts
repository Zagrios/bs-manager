import React from "react";
import TestRenderer from "react-test-renderer";
import { SettingToogleSwitchGrid } from "renderer/components/settings/setting-toogle-switch-grid.component";

jest.mock("renderer/hooks/use-theme-color.hook", () => ({
    useThemeColor: jest.fn(() => ({ firstColor: "#336699" })),
}));
jest.mock("renderer/helpers/correct-text-color", () => ({
    getCorrectTextColor: jest.fn(() => "#ffffff"),
}));

describe("settings toggle accessibility", () => {
    it("names and describes the close-after-launch switch and exposes keyboard focus", () => {
        const renderer = TestRenderer.create(React.createElement(SettingToogleSwitchGrid, {
            items: [{
                checked: false,
                text: "Close BSManager when Beat Saber launches",
                desc: "Closes BSManager once the Beat Saber window is ready.",
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
    });
});
