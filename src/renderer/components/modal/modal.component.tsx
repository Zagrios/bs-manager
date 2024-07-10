import { ModalExitCode, ModalObject, ModalService } from "renderer/services/modale.service";
import { AnimatePresence, motion } from "framer-motion";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useEffect } from "react";
import { BsmIcon } from "../svgs/bsm-icon.component";
import { ThemeColorGradientSpliter } from "../shared/theme-color-gradient-spliter.component";
import { map } from "rxjs";
import { useConstant } from "renderer/hooks/use-constant.hook";

export function Modal() {
    const modalSevice = ModalService.getInstance();

    const modals$ = useConstant(() => modalSevice.getModalToShow());

    const modals = useObservable(() => modals$);
    const currentModal = useObservable<ModalObject>(() =>modals$.pipe(map(modals => modals?.at(-1))));

    useEffect(() => {
        const onEscape = (e: KeyboardEvent) => {
            if (e.key !== "Escape") {
                return;
            }
            currentModal.resolver({ exitCode: ModalExitCode.CLOSED });
        };

        if (currentModal) {
            window.addEventListener("keyup", onEscape);
        } else {
            window.removeEventListener("keyup", onEscape);
        }

        return () => {
            window.removeEventListener("keyup", onEscape);
        };
    }, [currentModal]);

    const renderModal = (modal: ModalObject) => {
        if (!modal?.modal) { return null; }

        if(modal.options?.noStyle){
            return <modal.modal resolver={modal.resolver} options={modal.options} />
        }

        return (
            <div className="relative p-4 text-gray-800 dark:text-gray-200 rounded-md shadow-lg shadow-black bg-gradient-to-br from-light-main-color-3 to-light-main-color-2 dark:from-main-color-3 dark:to-main-color-2">
                <ThemeColorGradientSpliter className="absolute top-0 w-full left-0 h-1 rounded-t-md overflow-hidden"/>
                <div
                    className="w-2.5 h-2.5 absolute top-2.5 right-1.5 cursor-pointer"
                    onClick={e => {
                        e.stopPropagation();
                        modal.resolver({ exitCode: ModalExitCode.CLOSED });
                    }}
                >
                    <BsmIcon className="size-full" icon="cross" />
                </div>
                <modal.modal resolver={modal.resolver} options={modal.options} />
            </div>
        )
    }

    return (
            <AnimatePresence>
                {currentModal ? <motion.span key={crypto.randomUUID()} onClick={() => currentModal.resolver({ exitCode: ModalExitCode.NO_CHOICE })} className="fixed size-full bg-black z-[90]" initial={{ opacity: 0 }} animate={{ opacity: currentModal && 0.6 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} /> : undefined}
                {modals?.map(modal => (
                    <motion.div key={crypto.randomUUID()} className="fixed z-[90] top-1/2 left-1/2" initial={{ y: "100vh", x: "-50%" }} animate={{y: "-50%", scale: modal === currentModal ? 1 : 0, opacity: modal === currentModal ? 1 : 0, display: modal === currentModal ? "block" : ["block", "none"]}} exit={{ y: "100vh" }}>
                        {renderModal(modal)}
                    </motion.div>
                ))}
            </AnimatePresence>
    );
}
