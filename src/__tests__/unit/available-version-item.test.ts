import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { BSVersion } from "shared/bs-version.interface";

jest.mock("dateformat", () => jest.fn(() => "formatted date"));
jest.mock("framer-motion", () => ({ motion: { li: "li" } }));
jest.mock("renderer/components/shared/bsm-image.component", () => ({
    BsmImage: () => null,
}));
jest.mock("renderer/components/shared/glow-effect.component", () => ({
    GlowEffect: () => null,
}));
jest.mock("renderer/components/svgs/icons/steam-icon.component", () => ({
    SteamIcon: () => null,
}));
jest.mock("renderer/hooks/use-translation.hook", () => ({
    useTranslation: () => (key: string) => key,
}));
jest.mock("renderer/hooks/use-constant.hook", () => ({
    useConstant: (factory: () => unknown) => factory(),
}));
jest.mock("renderer/components/shared/bsm-button.component", () => {
    const ReactModule = jest.requireActual("react") as typeof import("react");

    return {
        BsmButton: ({ onClick, disabled, title }: any) => ReactModule.createElement("button", { onClick, disabled, title }),
    };
});
jest.mock("renderer/pages/available-versions-list.components", () => {
    const ReactModule = jest.requireActual("react") as typeof import("react");

    return {
        AvailableVersionsContext: ReactModule.createContext(null),
    };
});

const { AvailableVersionsContext } = require(
    "renderer/pages/available-versions-list.components"
) as typeof import("renderer/pages/available-versions-list.components");

const { AvailableVersionItem } = require(
    "renderer/components/available-versions/available-version-item.component"
) as typeof import("renderer/components/available-versions/available-version-item.component");

const version: BSVersion = {
    BSVersion: "1.44.2",
    ReleaseDate: "1710000000",
    ReleaseURL: "https://steamcommunity.com/example",
};

function renderItem(downloading = false) {
    const startDownload = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
        renderer = TestRenderer.create(
            React.createElement(
                AvailableVersionsContext.Provider,
                { value: { startDownload, downloading } },
                React.createElement(AvailableVersionItem, { version })
            )
        );
    });

    return { renderer, startDownload };
}

describe("AvailableVersionItem download interactions", () => {
    it("starts the existing download flow when the card is double-clicked", () => {
        const { renderer, startDownload } = renderItem();

        act(() => renderer.root.findByType("li").props.onDoubleClick());

        expect(startDownload).toHaveBeenCalledTimes(1);
        expect(startDownload).toHaveBeenCalledWith(version);
        act(() => renderer.unmount());
    });

    it("isolates the Steam link and download button from the card double-click", () => {
        const { renderer, startDownload } = renderItem();
        const actions = renderer.root.findAllByType("div").find(node => node.props.className === "flex flex-row items-center gap-1.5");
        const link = renderer.root.findByType("a");
        const clickStop = jest.fn();
        const doubleClickStop = jest.fn();

        act(() => link.props.onClick({ stopPropagation: clickStop }));
        act(() => actions!.props.onDoubleClick({ stopPropagation: doubleClickStop }));

        expect(clickStop).toHaveBeenCalledTimes(1);
        expect(doubleClickStop).toHaveBeenCalledTimes(1);
        expect(startDownload).not.toHaveBeenCalled();
        act(() => renderer.unmount());
    });

    it("keeps the existing download button behavior and disabled state", () => {
        const { renderer, startDownload } = renderItem();
        const button = renderer.root.findByType("button");
        const stopPropagation = jest.fn();

        act(() => button.props.onClick({ stopPropagation }));

        expect(stopPropagation).toHaveBeenCalledTimes(1);
        expect(startDownload).toHaveBeenCalledTimes(1);
        expect(startDownload).toHaveBeenCalledWith(version);
        expect(button.props.disabled).toBe(false);
        act(() => renderer.unmount());

        const disabledItem = renderItem(true);
        expect(disabledItem.renderer.root.findByType("button").props.disabled).toBe(true);
        act(() => disabledItem.renderer.unmount());
    });
});
