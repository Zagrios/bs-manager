import { ModalExitCode, ModalResponse, ModalService } from "../../../services/modale.service";
import BeatConflict from "../../../../../assets/images/apngs/beat-conflict.png"
import { BSVersion } from "main/services/bs-version-manager.service";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";

export function UninstallModal({resolver}: {resolver: (x: ModalResponse) => void}) {

    const version = ModalService.getInsance().getModalData<BSVersion>();
    const t = useTranslation();

  return (
    <form onSubmit={(e) => {e.preventDefault(); resolver({exitCode: ModalExitCode.COMPLETED})}}>
        <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">{t("modals.bs-uninstall.title")}</h1>
        <BsmImage className="mx-auto h-24" image={BeatConflict}/>
        <p className="max-w-sm text-gray-800 dark:text-gray-200">{t("modals.bs-uninstall.description", {version: version.BSVersion})}</p>
        <div className="grid grid-flow-col grid-cols-2 gap-4 mt-4">
            <BsmButton className="rounded-md text-center bg-gray-500 hover:brightness-110 transition-all" onClick={() => {resolver({exitCode: ModalExitCode.CANCELED})}} withBar={false} text="misc.cancel"/>
            <BsmButton className="rounded-md text-center bg-blue-500 hover:brightness-110 transition-all" type="submit" withBar={false} text="modals.bs-uninstall.buttons.submit"/>
        </div>
    </form>
  )
}
