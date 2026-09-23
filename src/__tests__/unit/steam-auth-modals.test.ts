import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Subject, take } from "rxjs";
import { SteamGuardModal } from "renderer/components/modal/modal-types/bs-downgrade/steam-guard-modal.component";
import { SteamMobileApproveModal } from "renderer/components/modal/modal-types/bs-downgrade/steam-mobile-approve-modal.component";
import { ModalExitCode } from "renderer/services/modale.service";

jest.mock("renderer/hooks/use-translation.hook", () => ({ useTranslation: () => (key: string) => key }));
jest.mock("renderer/components/shared/bsm-image.component", () => ({ BsmImage: () => React.createElement("img") }));
jest.mock("renderer/components/shared/bsm-button.component", () => ({ BsmButton: () => React.createElement("button") }));

describe("Steam authentication dialogs", () => {
    it.each(["code", "mobile"])("closes %s on Steam authentication without submitting a code", mode => {
        const logged = new Subject<void>();
        let renderer: TestRenderer.ReactTestRenderer;
        const resolver = jest.fn();
        const props = { resolver, options: { data: { logged$: logged.pipe(take(1)) } } };
        act(() => { renderer = TestRenderer.create(mode === "code" ? React.createElement(SteamGuardModal, props) : React.createElement(SteamMobileApproveModal, props)); });
        expect(resolver).not.toHaveBeenCalled();
        act(() => { logged.next(); });
        expect(resolver.mock.calls[0]?.[0]).toEqual({ exitCode: ModalExitCode.COMPLETED });
        act(() => { renderer.unmount(); });
    });

    it("still submits a typed Steam Guard code", () => {
        const resolver = jest.fn();
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => { renderer = TestRenderer.create(React.createElement(SteamGuardModal, { resolver })); });
        act(() => { renderer.root.findByType("input").props.onChange({ target: { value: "a bcde" } }); });
        act(() => { renderer.root.findByType("form").props.onSubmit({ preventDefault: jest.fn() }); });
        expect(resolver).toHaveBeenCalledWith({ exitCode: ModalExitCode.COMPLETED, data: "ABCDE" });
        act(() => { renderer.unmount(); });
    });
});
