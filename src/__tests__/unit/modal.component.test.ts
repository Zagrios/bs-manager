import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Modal } from "renderer/components/modal/modal.component";
import { ModalObject } from "renderer/services/modale.service";

const mockModalsObservable = { pipe: jest.fn() };
let mockModals: ModalObject[] = [];
let mockCurrentModal: ModalObject | undefined;

jest.mock("renderer/hooks/use-constant.hook", () => ({
    useConstant: () => mockModalsObservable,
}));
jest.mock("renderer/hooks/use-observable.hook", () => ({
    useObservable: (factory: () => unknown) => (
        factory() === mockModalsObservable ? mockModals : mockCurrentModal
    ),
}));
jest.mock("renderer/services/modale.service", () => ({
    ModalExitCode: { CLOSED: 1, NO_CHOICE: -1 },
    ModalService: { getInstance: () => ({ getModalToShow: () => mockModalsObservable }) },
}));
jest.mock("framer-motion", () => {
    const ReactModule = jest.requireActual("react") as typeof React;
    const motionComponent = (type: string) => ReactModule.forwardRef((props: any, ref) => (
        ReactModule.createElement(type, { ...props, ref }, props.children)
    ));
    return {
        AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
        motion: { div: motionComponent("div"), span: motionComponent("span") },
    };
});
jest.mock("renderer/components/svgs/bsm-icon.component", () => ({ BsmIcon: (): null => null }));
jest.mock("renderer/components/shared/theme-color-gradient-spliter.component", () => ({ ThemeColorGradientSpliter: (): null => null }));

class FakeElement extends EventTarget {
    public children: FakeElement[] = [];
    public focusCount = 0;
    public isConnected = true;
    public parentElement?: FakeElement;
    public focusable: FakeElement[] = [];
    private readonly attributes = new Map<string, string>();

    public constructor(public readonly name: string) {
        super();
    }

    public contains(element: unknown) {
        return element === this || this.focusable.includes(element as FakeElement);
    }

    public focus() {
        this.focusCount += 1;
        fakeDocument.activeElement = this;
    }

    public getClientRects() {
        return [{}];
    }

    public matches() {
        return false;
    }

    public querySelectorAll() {
        return this.focusable;
    }

    public closest(selector: string) {
        if (selector !== "[inert]") {
            return null;
        }
        return this.hasAttribute("inert") || this.parentElement?.hasAttribute("inert") ? this : null;
    }

    public getAttribute(name: string) {
        return this.attributes.get(name) ?? null;
    }

    public hasAttribute(name: string) {
        return this.attributes.has(name);
    }

    public removeAttribute(name: string) {
        this.attributes.delete(name);
    }

    public setAttribute(name: string, value: string) {
        this.attributes.set(name, value);
    }
}

const fakeDocument = Object.assign(new EventTarget(), { activeElement: undefined as FakeElement });

function keyEvent(key: string, shiftKey = false) {
    const event = new Event("keydown", { cancelable: true }) as KeyboardEvent;
    Object.defineProperties(event, {
        key: { value: key },
        shiftKey: { value: shiftKey },
    });
    return event;
}

describe("Modal focus management", () => {
    const windowEvents = new EventTarget();
    const parent = new FakeElement("parent");
    const shortcutControl = new FakeElement("shortcut control");
    const overlay = new FakeElement("overlay");
    const container = new FakeElement("modal container");
    const firstModalControl = new FakeElement("first modal control");
    const lastModalControl = new FakeElement("last modal control");

    beforeAll(() => {
        Object.defineProperty(global, "HTMLElement", { configurable: true, value: FakeElement });
        Object.defineProperty(global, "window", { configurable: true, value: windowEvents });
        Object.defineProperty(global, "document", { configurable: true, value: fakeDocument });
        overlay.setAttribute("data-modal-overlay", "true");
        parent.children = [shortcutControl, overlay, container];
        shortcutControl.parentElement = parent;
        overlay.parentElement = parent;
        container.parentElement = parent;
        container.focusable = [firstModalControl, lastModalControl];
        firstModalControl.parentElement = container;
        lastModalControl.parentElement = container;
    });

    it("contains Tab focus, makes the background inert, and restores focus", () => {
        const resolver = jest.fn();
        mockCurrentModal = {
            id: "runtime-warning",
            modal: () => React.createElement("div", { role: "dialog" }),
            options: {},
            resolver,
        };
        mockModals = [mockCurrentModal];
        fakeDocument.activeElement = shortcutControl;

        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(React.createElement(Modal), {
                createNodeMock: element => element.props.tabIndex === -1 ? container : new FakeElement(`${element.type}`),
            });
        });

        expect(fakeDocument.activeElement).toBe(firstModalControl);
        expect(shortcutControl.hasAttribute("inert")).toBe(true);
        expect(shortcutControl.getAttribute("aria-hidden")).toBe("true");
        expect(overlay.hasAttribute("inert")).toBe(false);

        lastModalControl.focus();
        const tab = keyEvent("Tab");
        window.dispatchEvent(tab);
        expect(tab.defaultPrevented).toBe(true);
        expect(fakeDocument.activeElement).toBe(firstModalControl);

        const shiftTab = keyEvent("Tab", true);
        window.dispatchEvent(shiftTab);
        expect(shiftTab.defaultPrevented).toBe(true);
        expect(fakeDocument.activeElement).toBe(lastModalControl);

        shortcutControl.focus();
        fakeDocument.dispatchEvent(new Event("focusin"));
        expect(fakeDocument.activeElement).toBe(firstModalControl);

        mockModals = [];
        mockCurrentModal = undefined;
        act(() => renderer.update(React.createElement(Modal)));

        expect(shortcutControl.hasAttribute("inert")).toBe(false);
        expect(shortcutControl.hasAttribute("aria-hidden")).toBe(false);
        expect(fakeDocument.activeElement).toBe(shortcutControl);
        act(() => renderer.unmount());
    });
});
