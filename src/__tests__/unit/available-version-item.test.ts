import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { BSVersion } from "shared/bs-version.interface";

jest.mock("dateformat", () => jest.fn(() => "formatted date"));
jest.mock("framer-motion", () => ({
    motion: { li: "li", div: "div", span: "span", button: "button" },
}));
jest.mock("renderer/components/shared/bsm-image.component", () => {
    const ReactModule = jest.requireActual("react") as typeof import("react");

    return {
        BsmImage: ({ className }: { className?: string }) => ReactModule.createElement("img", { className }),
    };
});
jest.mock("renderer/components/shared/glow-effect.component", () => ({
    GlowEffect: () => null,
}));
jest.mock("renderer/components/svgs/icons/steam-icon.component", () => ({
    SteamIcon: () => null,
}));
jest.mock("renderer/components/svgs/icons/download-icon.component", () => ({
    DownloadIcon: () => null,
}));
jest.mock("renderer/hooks/use-translation.hook", () => ({
    useTranslation: () => (key: string) => key,
}));
jest.mock("renderer/hooks/use-constant.hook", () => ({
    useConstant: (factory: () => unknown) => factory(),
}));
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
    it("does not attach a download action to the card", () => {
        const { renderer, startDownload } = renderItem();
        const card = renderer.root.findByType("li");

        expect(card.props.onClick).toBeUndefined();
        expect(card.props.onDoubleClick).toBeUndefined();
        expect(startDownload).not.toHaveBeenCalled();
        act(() => renderer.unmount());
    });

    it("lets CSS drive the hover animation without persistent component state", () => {
        const { renderer } = renderItem();
        const card = renderer.root.findByType("li");
        const slices = () => renderer.root.findAllByType("span").filter(node => node.props["data-download-slice"]);

        expect(card.props.className).toContain("available-version-card");
        expect(card.props.onHoverStart).toBeUndefined();
        expect(card.props.onHoverEnd).toBeUndefined();
        expect(card.props.onFocusCapture).toBeUndefined();
        expect(card.props.onBlurCapture).toBeUndefined();
        expect(slices()).toHaveLength(2);
        expect(slices().map(slice => slice.props["data-download-slice"])).toEqual(["left", "right"]);
        expect(slices().map(slice => slice.props.style.clipPath)).toEqual([
            "polygon(0 0, 59% 0, 41% 100%, 0 100%)",
            "polygon(59% 0, 100% 0, 100% 100%, 41% 100%)",
        ]);
        expect(slices()[0].props.className).toContain("available-version-download-slice--left");
        expect(slices()[1].props.className).toContain("available-version-download-slice--right");
        expect(slices()[0].props.className).toContain("z-[1]");
        expect(slices()[1].props.className).toContain("z-[2]");
        act(() => renderer.unmount());
    });

    it("keeps the image and footer proportions fixed", () => {
        const { renderer } = renderItem();
        const releaseImage = renderer.root.findAllByType("img").find(node => node.props.className.includes("h-3/4"));
        const footer = renderer.root.findAllByType("div").find(node => node.props.className?.includes("h-1/4"));
        const downloadSurface = renderer.root.findByType("button");

        expect(releaseImage!.props.className).toContain("shrink-0");
        expect(releaseImage!.props.className).not.toContain("scale-");
        expect(footer!.props.className).toContain("shrink-0");
        expect(downloadSurface.props.className).toContain("h-3/4");
        expect(downloadSurface.props.className).toContain("w-full");
        expect(downloadSurface.props.className).not.toContain("rounded");
        act(() => renderer.unmount());
    });

    it("keeps the Steam link separate from the download action", () => {
        const { renderer, startDownload } = renderItem();
        const link = renderer.root.findByType("a");
        const clickStop = jest.fn();

        act(() => link.props.onClick({ stopPropagation: clickStop }));

        expect(clickStop).toHaveBeenCalledTimes(1);
        expect(startDownload).not.toHaveBeenCalled();
        act(() => renderer.unmount());
    });

    it("downloads from the large button with a single click and exposes its disabled state", () => {
        const { renderer, startDownload } = renderItem();
        const button = renderer.root.findByType("button");
        const stopPropagation = jest.fn();

        act(() => button.props.onClick({ stopPropagation }));

        expect(stopPropagation).toHaveBeenCalledTimes(1);
        expect(startDownload).toHaveBeenCalledTimes(1);
        expect(startDownload).toHaveBeenCalledWith(version);
        expect(button.props.disabled).toBe(false);
        expect(button.props.type).toBe("button");
        expect(button.props["aria-label"]).toBe("misc.download 1.44.2");
        act(() => renderer.unmount());

        const disabledItem = renderItem(true);
        expect(disabledItem.renderer.root.findByType("button").props.disabled).toBe(true);
        act(() => disabledItem.renderer.unmount());
    });
});
