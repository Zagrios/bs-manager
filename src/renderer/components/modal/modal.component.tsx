import { ModalExitCode, ModalObject, ModalService } from "renderer/services/modale.service";
import { AnimatePresence, motion } from "framer-motion";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useEffect, useRef } from "react";
import { BsmIcon } from "../svgs/bsm-icon.component";
import { ThemeColorGradientSpliter } from "../shared/theme-color-gradient-spliter.component";
import { map } from "rxjs";
import { useConstant } from "renderer/hooks/use-constant.hook";

const FOCUSABLE_SELECTOR = [
    "a[href]",
    "area[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "iframe",
    "object",
    "embed",
    "[contenteditable='true']",
    "[tabindex]:not([tabindex='-1'])",
].join(",");

export function Modal() {
    const modalSevice = ModalService.getInstance();
    const activeModalRef = useRef<HTMLDivElement>(null);
    const modalsRef = useRef<ModalObject[]>();

    const modals$ = useConstant(() => modalSevice.getModalToShow());

    const modals = useObservable(() => modals$);
    const currentModal = useObservable<ModalObject>(() =>modals$.pipe(map(modals => modals?.at(-1))));
    modalsRef.current = modals;

    useEffect(() => {
        if (!currentModal || !activeModalRef.current) {
            return undefined;
        }

        const modalContainer = activeModalRef.current;
        const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : undefined;
        const backgroundElements = Array.from(modalContainer.parentElement?.children ?? [])
            .filter((element): element is HTMLElement => (
                element instanceof HTMLElement &&
                element !== modalContainer &&
                !element.hasAttribute("data-modal-overlay")
            ))
            .map(element => ({
                element,
                ariaHidden: element.getAttribute("aria-hidden"),
                inert: element.hasAttribute("inert"),
            }));

        backgroundElements.forEach(({ element }) => {
            element.setAttribute("aria-hidden", "true");
            element.setAttribute("inert", "");
        });

        const getFocusableElements = () => Array.from(modalContainer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(element => (
            element.getClientRects().length > 0 &&
            !element.matches(":disabled") &&
            !element.closest("[aria-hidden='true'], [hidden], [inert]")
        ));

        const focusModalEdge = (edge: "first" | "last", focusable = getFocusableElements()) => {
            (focusable.at(edge === "first" ? 0 : -1) ?? modalContainer).focus();
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                if (currentModal.options?.closable === false) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                currentModal.resolver({ exitCode: ModalExitCode.CLOSED });
                return;
            }

            if (event.key !== "Tab") {
                return;
            }

            const focusable = getFocusableElements();
            const first = focusable.at(0);
            const last = focusable.at(-1);
            const { activeElement } = document;

            if (!first || !last || !modalContainer.contains(activeElement)) {
                event.preventDefault();
                focusModalEdge(event.shiftKey ? "last" : "first", focusable);
            } else if (event.shiftKey && activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        const onFocusIn = (event: FocusEvent) => {
            if (!modalContainer.contains(event.target as Node)) {
                focusModalEdge("first");
            }
        };

        window.addEventListener("keydown", onKeyDown);
        document.addEventListener("focusin", onFocusIn);

        if (!modalContainer.contains(document.activeElement)) {
            focusModalEdge("first");
        }

        return () => {
            window.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("focusin", onFocusIn);
            backgroundElements.forEach(({ element, ariaHidden, inert }) => {
                if (ariaHidden === null) {
                    element.removeAttribute("aria-hidden");
                } else {
                    element.setAttribute("aria-hidden", ariaHidden);
                }
                if (!inert) {
                    element.removeAttribute("inert");
                }
            });

            const modalIsStillOpen = modalsRef.current?.some(modal => modal.id === currentModal.id);
            if (!modalIsStillOpen && previouslyFocused?.isConnected) {
                previouslyFocused.focus();
            }
        };
    }, [currentModal]);

    const renderCloseButton = (modal: ModalObject) => {
        return (
            <button
                aria-label="Close"
                type="button"
                className="w-2.5 h-2.5 absolute top-2.5 right-1.5 cursor-pointer"
                onClick={e => {
                    e.stopPropagation();
                    modal.resolver({ exitCode: ModalExitCode.CLOSED });
                }}
            >
                <BsmIcon className="size-full" icon="cross" />
            </button>
        )
    }

    const renderModal = (modal: ModalObject) => {
        if (!modal?.modal) { return null; }

        if(modal.options?.noStyle){
            return <modal.modal resolver={modal.resolver} options={modal.options} />
        }

        return (
            <div className="relative max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto scrollbar-default p-4 text-gray-800 dark:text-gray-200 rounded-md shadow-lg shadow-black bg-gradient-to-br from-light-main-color-3 to-light-main-color-2 dark:from-main-color-3 dark:to-main-color-2">
                <ThemeColorGradientSpliter className="absolute top-0 w-full left-0 h-1 rounded-t-md overflow-hidden"/>
                {modal.options?.closable === false ? undefined : renderCloseButton(modal)}
                <modal.modal resolver={modal.resolver} options={modal.options} />
            </div>
        )
    }

    const onOverlayClicked = () => {
        if (currentModal.options?.closable === false) {
            return;
        }

        currentModal.resolver({ exitCode: ModalExitCode.NO_CHOICE });
    }

    return (
            <AnimatePresence>
                {currentModal ? <motion.span aria-hidden="true" data-modal-overlay="true" key="modal-overlay" onClick={onOverlayClicked} className="fixed size-full bg-black z-[90]" initial={{ opacity: 0 }} animate={{ opacity: currentModal && 0.6 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} /> : undefined}
                {modals?.map(modal => (
                    <motion.div aria-hidden={modal === currentModal ? undefined : "true"} ref={modal === currentModal ? activeModalRef : undefined} tabIndex={-1} key={modal.id} className="fixed z-[90] top-1/2 left-1/2" initial={{ y: "100vh", x: "-50%" }} animate={{y: "-50%", scale: modal === currentModal ? 1 : 0, opacity: modal === currentModal ? 1 : 0, display: modal === currentModal ? "block" : ["block", "none"]}} exit={{ y: "100vh" }}>
                        {renderModal(modal)}
                    </motion.div>
                ))}
            </AnimatePresence>
    );
}
