import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SettingFolderInput } from "renderer/components/settings/setting-folder-input.component";
import { InstallationFolderModal } from "renderer/components/modal/modal-types/installation-folder-modal.component";
import en from "../../../assets/jsons/translations/en.json";

jest.mock("renderer/components/shared/bsm-button.component", () => {
    const ReactModule = jest.requireActual("react") as typeof React;

    return {
        BsmButton: ({ text, onClick, disabled }: { text: string; onClick: () => void; disabled?: boolean }) => ReactModule.createElement("button", { "data-text": text, disabled, onClick }),
    };
});
jest.mock("renderer/components/shared/bsm-image.component", () => ({
    BsmImage: () => null,
}));
jest.mock("renderer/hooks/use-translation.hook", () => ({
    useTranslation: () => (key: string) => key,
}));

describe("SettingFolderInput", () => {
    it("labels typed-path confirmation as Apply", () => {
        const renderer = TestRenderer.create(React.createElement(InstallationFolderModal, {
            resolver: jest.fn(),
            options: { data: { submitText: "misc.apply" } },
        }));

        expect(renderer.root.findByProps({ "data-text": "misc.apply" })).toBeDefined();
        act(() => renderer.unmount());
    });

    it("provides a clear validation message for an invalid installation folder", () => {
        expect(en.pages.settings["installation-folder"].errors["invalid-folder"]).toBe("Invalid folder path");
    });

    it("lets users edit and apply a folder path", () => {
        const onChange = jest.fn();
        const onApply = jest.fn();
        let renderer!: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(React.createElement(SettingFolderInput, {
                value: "C:\\BSManager",
                label: "Installation folder",
                canApply: true,
                onChange,
                onApply,
                onChoose: jest.fn(),
            }));
        });

        const input = renderer.root.findByType("input");
        const applyButton = renderer.root.findByProps({ "data-text": "misc.apply" });

        act(() => input.props.onChange({ target: { value: "D:\\Games\\BSManager" } }));
        act(() => applyButton.props.onClick());

        expect(input.props.value).toBe("C:\\BSManager");
        expect(input.props["aria-label"]).toBe("Installation folder");
        expect(onChange).toHaveBeenCalledWith("D:\\Games\\BSManager");
        expect(onApply).toHaveBeenCalledTimes(1);
        act(() => renderer.unmount());
    });

    it("keeps the folder chooser and disables applying an unchanged path", () => {
        const onChoose = jest.fn();
        let renderer!: TestRenderer.ReactTestRenderer;

        act(() => {
            renderer = TestRenderer.create(React.createElement(SettingFolderInput, {
                value: "C:\\BSManager",
                label: "Installation folder",
                canApply: false,
                onChange: jest.fn(),
                onApply: jest.fn(),
                onChoose,
            }));
        });

        const applyButton = renderer.root.findByProps({ "data-text": "misc.apply" });
        const chooseButton = renderer.root.findByProps({ "data-text": "misc.choose-folder" });

        act(() => chooseButton.props.onClick());

        expect(applyButton.props.disabled).toBe(true);
        expect(onChoose).toHaveBeenCalledTimes(1);
        act(() => renderer.unmount());
    });
});
