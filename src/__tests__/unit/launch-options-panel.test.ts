jest.mock("@tippyjs/react", () => jest.fn());
jest.mock("renderer/components/shared/bsm-checkbox.component", () => ({ BsmCheckbox: jest.fn() }));
jest.mock("renderer/components/svgs/icons/pin-icon.component", () => ({ PinIcon: jest.fn() }));
jest.mock("renderer/components/svgs/icons/unpin-icon.component", () => ({ UnpinIcon: jest.fn() }));
jest.mock("renderer/components/svgs/icons/add-icon.component", () => ({ AddIcon: jest.fn() }));
jest.mock("renderer/components/svgs/icons/edit-icon.component", () => ({ EditIcon: jest.fn() }));
jest.mock("renderer/components/svgs/icons/trash-icon.component", () => ({ TrashIcon: jest.fn() }));
jest.mock("renderer/helpers/css-class.helpers", () => ({ cn: jest.fn() }));
jest.mock("renderer/hooks/use-theme-color.hook", () => ({ useThemeColor: jest.fn() }));
jest.mock("renderer/hooks/use-translation.hook", () => ({
    useTranslationV2: jest.fn(() => ({ text: jest.fn() })),
}));

const { hasActiveVisibleUnpinnedLaunchMod } = require(
    "renderer/components/version-viewer/slides/launch/launch-options-panel.component"
) as typeof import("renderer/components/version-viewer/slides/launch/launch-options-panel.component");

describe("advanced launch indicator", () => {
    it("ignores active launch options that are hidden or pinned", () => {
        expect(hasActiveVisibleUnpinnedLaunchMod([
            { id: "hidden", label: "Hidden", active: true, visible: false, pinned: false },
            { id: "pinned", label: "Pinned", active: true, visible: true, pinned: true },
            { id: "inactive", label: "Inactive", active: false, visible: true, pinned: false },
        ])).toBe(false);
    });

    it("detects an active launch option that is visible and unpinned", () => {
        expect(hasActiveVisibleUnpinnedLaunchMod([
            { id: "advanced", label: "Advanced", active: true, visible: true, pinned: false },
        ])).toBe(true);
    });
});
