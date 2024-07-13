import { ModalComponent, ModalExitCode } from "../../../services/modale.service";
import BeatConflict from "../../../../../assets/images/apngs/beat-conflict.png";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { BSVersion } from "shared/bs-version.interface";

export const UninstallAllModsModal: ModalComponent<void, BSVersion> = ({ resolver, options: {data} }) => {
    const version = data;
    const t = useTranslation();

    const desc = "modals.uninstall-all-mods.description";

    return (
        <form
            onSubmit={e => {
                e.preventDefault();
                resolver({ exitCode: ModalExitCode.COMPLETED });
            }}
        >
            <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">{t("modals.uninstall-all-mods.title")}</h1>
            <BsmImage className="mx-auto h-24" image={BeatConflict} />
            <p className="max-w-sm text-gray-800 dark:text-gray-200">{t(desc, { version: version.name ?? version.BSVersion })}</p>
            <div className="grid grid-flow-col grid-cols-2 gap-4 mt-4">
                <BsmButton
                    typeColor="cancel"
                    className="rounded-md text-center transition-all"
                    onClick={() => {
                        resolver({ exitCode: ModalExitCode.CANCELED });
                    }}
                    withBar={false}
                    text="misc.cancel"
                />
                <BsmButton typeColor="primary" className="rounded-md text-center transition-all" type="submit" withBar={false} text="modals.bs-uninstall.buttons.submit" />
            </div>
        </form>
    );
};
