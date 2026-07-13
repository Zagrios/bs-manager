import React from "react";
import TestRenderer from "react-test-renderer";
import { VrRuntimeMismatchModal } from "renderer/components/modal/modal-types/vr-runtime-mismatch-modal.component";
import { VrRuntime } from "shared/models/vr-runtime.model";

jest.mock("renderer/hooks/use-translation.hook", () => ({ useTranslation: () => (key: string) => key }));
jest.mock("renderer/components/shared/bsm-image.component", () => ({ BsmImage: () => React.createElement("img") }));
jest.mock("renderer/components/shared/bsm-link.component", () => ({ BsmLink: ({ children }: { children: React.ReactNode }) => React.createElement("a", { href: "https://example.com" }, children) }));

describe("VrRuntimeMismatchModal accessibility", () => {
    it("exposes dialog, checkbox, and native keyboard controls", () => {
        const resolver = jest.fn();
        const renderer = TestRenderer.create(React.createElement(VrRuntimeMismatchModal, {
            resolver,
            options: { data: VrRuntime.UNKNOWN },
        }));

        const form = renderer.root.findByType("form");
        expect(form.props).toEqual(expect.objectContaining({
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "vr-runtime-warning-title",
        }));
        expect(renderer.root.findByType("input").props.type).toBe("checkbox");
        expect(renderer.root.findAllByType("button").map(button => button.props.type)).toEqual(["button", "submit"]);
        expect(renderer.root.findByType("a").props.href).toBeTruthy();
    });
});
