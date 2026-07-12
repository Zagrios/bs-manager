import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { BehaviorSubject, of } from "rxjs";
import { OpenXrRuntimeStatus } from "renderer/components/settings/openxr-runtime-status.component";
import { useService } from "renderer/hooks/use-service.hook";
import { VrRuntime } from "shared/models/vr-runtime.model";
import { ConfigurationService } from "renderer/services/configuration.service";

jest.mock("renderer/hooks/use-service.hook", () => ({ useService: jest.fn() }));
jest.mock("renderer/hooks/use-translation.hook", () => ({
    useTranslation: () => (key: string, args?: Record<string, string>) => args?.runtime ? `${key}:${args.runtime}` : key,
}));
jest.mock("renderer/services/configuration.service", () => ({ ConfigurationService: { getInstance: jest.fn() } }));
jest.mock("renderer/services/ipc.service", () => ({ IpcService: { getInstance: jest.fn() } }));

describe("OpenXrRuntimeStatus", () => {
    const windowEvents = new EventTarget();
    const documentEvents = new EventTarget();

    beforeAll(() => {
        Object.assign(windowEvents, { electron: { platform: "win32" } });
        Object.defineProperty(global, "window", { configurable: true, value: windowEvents });
        Object.defineProperty(documentEvents, "visibilityState", { configurable: true, value: "visible" });
        Object.defineProperty(global, "document", { configurable: true, value: documentEvents });
    });

    it("refreshes after focus changes and tracks warning dismissal while mounted", async () => {
        const runtimes = [VrRuntime.STEAM, VrRuntime.OCULUS];
        const sendV2 = jest.fn(() => of(runtimes.shift() ?? VrRuntime.OCULUS));
        const warningDisabled$ = new BehaviorSubject(true);
        const config = {
            watch: jest.fn(() => warningDisabled$.asObservable()),
            set: jest.fn((_key: string, value: boolean) => warningDisabled$.next(value)),
            delete: jest.fn(() => warningDisabled$.next(false)),
        };
        const ipc = { sendV2 };
        (useService as jest.Mock).mockImplementation(service => (
            service === ConfigurationService ? config : ipc
        ));

        let renderer: TestRenderer.ReactTestRenderer;
        await act(async () => {
            renderer = TestRenderer.create(React.createElement(OpenXrRuntimeStatus));
            await Promise.resolve();
        });
        expect(sendV2).toHaveBeenCalledTimes(1);

        await act(async () => {
            window.dispatchEvent(new Event("focus"));
            await Promise.resolve();
        });
        expect(sendV2).toHaveBeenCalledTimes(2);
        expect(renderer.root.findByProps({ "aria-live": "polite" }).children.join(""))
            .toContain("modals.vr-runtime-mismatch.runtimes.oculus");

        const restoreButton = renderer.root.findAllByType("button")
            .find(button => button.children.includes("pages.settings.openxr.restore-warning"));
        expect(restoreButton).toBeDefined();
        act(() => restoreButton?.props.onClick());
        expect(config.delete).toHaveBeenCalledWith("dont-remind-vr-runtime");
        expect(renderer.root.findAllByType("button").some(button => button.children.includes("pages.settings.openxr.restore-warning"))).toBe(false);

        act(() => config.set("dont-remind-vr-runtime", true));
        expect(renderer.root.findAllByType("button").some(button => button.children.includes("pages.settings.openxr.restore-warning"))).toBe(true);

        act(() => renderer.unmount());
    });
});
