import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslationV2 } from "renderer/hooks/use-translation.hook";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import BeatRunning from "../../../../../assets/images/apngs/beat-running.png";
import Tippy from "@tippyjs/react";
import { BsmLink } from "renderer/components/shared/bsm-link.component";
import { BSVersion } from "shared/bs-version.interface";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { useService } from "renderer/hooks/use-service.hook";
import { VersionFolderLinkerService } from "renderer/services/version-folder-linker.service";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useEffect, useState } from "react";
import { noop } from "shared/helpers/function.helpers";
import { MODEL_TYPE_FOLDERS } from "shared/models/models/constants";
import { PlaylistsManagerService } from "renderer/services/playlists-manager.service";
import { MapsManagerService } from "renderer/services/maps-manager.service";
import { map } from "rxjs";

export const LinkContentModal: ModalComponent<boolean, {version: BSVersion, contentType: "maps"|"playlists"|"avatars"|"sabers"|"platforms"|"blocks"}> = ({options: { data: { version, contentType } }, resolver }) => {
    const { text: t, element: te } = useTranslationV2();

    const versionLinker = useService(VersionFolderLinkerService);

    const sharedPath = useObservable(() => versionLinker.getSharedFolder().pipe(map(sharedPath => {
        switch(contentType){
            case "maps":
                return window.electron.path.join(sharedPath, "SharedMaps", "CustomLevels");
            case "playlists":
                return window.electron.path.join(sharedPath, PlaylistsManagerService.RELATIVE_PLAYLISTS_FOLDER);
            case "avatars":
                return window.electron.path.join(sharedPath, MODEL_TYPE_FOLDERS.avatar);
            case "sabers":
                return window.electron.path.join(sharedPath, MODEL_TYPE_FOLDERS.saber);
            case "platforms":
                return window.electron.path.join(sharedPath, MODEL_TYPE_FOLDERS.platform);
            case "blocks":
                return window.electron.path.join(sharedPath, MODEL_TYPE_FOLDERS.bloq);
            default:
                return "";
        }
    })), "");

    const contentsPath = useConstant(() => {
        switch(contentType){
            case "maps":
                return window.electron.path.join(version.path, MapsManagerService.RELATIVE_MAPS_FOLDER);
            case "playlists":
                return window.electron.path.join(version.path, PlaylistsManagerService.RELATIVE_PLAYLISTS_FOLDER);
            case "avatars":
                return window.electron.path.join(version.path, MODEL_TYPE_FOLDERS.avatar);
            case "sabers":
                return window.electron.path.join(version.path, MODEL_TYPE_FOLDERS.saber);
            case "platforms":
                return window.electron.path.join(version.path, MODEL_TYPE_FOLDERS.platform);
            case "blocks":
                return window.electron.path.join(version.path, MODEL_TYPE_FOLDERS.bloq);
            default:
                return "";
        }
    });
    const [pathCopied, setPathCopied] = useState<"maps"|"shared">(null);

    useEffect(() => {
        if(!pathCopied){
            return noop;
        }

        const timeout = setTimeout(() => {
            setPathCopied(() => null);
        }, 1000);

        return () => clearTimeout(timeout);
    }, [pathCopied])

    const putInClipboard = (text: string, element: "maps"|"shared") => {
        navigator.clipboard.writeText(text);
        setPathCopied(() => element);
    }

    return (
        <form className="text-gray-800 dark:text-gray-200">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t("modals.link-contents.title", { contentType: t(`misc.${contentType}`).toLowerCase() })}</h1>
            <BsmImage className="mx-auto h-24" image={BeatRunning} />
            <p className="max-w-sm w-full mb-3">{t("modals.link-contents.p-1", { contentType: t(`misc.${contentType}`).toLowerCase() })}</p>
            <p className="max-w-sm w-full mb-3">
                {te("modals.link-contents.p-2", {itemsHtml: (
                    <Tippy content={pathCopied === "maps" ? t("misc.copied") : contentsPath} hideOnClick={false} theme="default" maxWidth={Infinity}>
                        <button className="bg-theme-1 rounded-md px-1 cursor-pointer" onClick={e => { e.preventDefault(); putInClipboard(contentsPath, "maps") }}>{t(`misc.${contentType}`)}</button>
                    </Tippy>
                ), sharedHtml: (
                    <Tippy content={pathCopied === "shared" ? t("misc.copied") : sharedPath} hideOnClick={false} theme="default" maxWidth={Infinity}>
                        <button className="bg-theme-1 rounded-md px-1 cursor-pointer" onClick={e => { e.preventDefault(); putInClipboard(sharedPath, "shared") }}>{t("misc.shared")}</button>
                    </Tippy>
                ), contentType: <>{t(`misc.${contentType}`).toLowerCase()}</> })}
            </p>
            <p className="max-w-sm w-full italic my-2 text-warning-400">{t("modals.link-contents.warning", {contentType: t(`misc.${contentType}`).toLowerCase()})}</p>
            <div className="flex justify-center items-center gap-3 *:underline *:text-sm *:text-neutral-200">
                <BsmLink href="https://en.qrwp.org/Symbolic_link">{t("modals.link-contents.what-is-a-symbolic-link")}</BsmLink>
                <BsmLink href="https://discord.gg/uSqbHVpKdV">{t("modals.link-contents.i-need-help")}</BsmLink>
            </div>
            <div className="grid grid-flow-col grid-cols-2 gap-2 mt-4 h-8">
                <BsmButton typeColor="cancel" className="rounded-md text-center transition-all flex justify-center items-center" onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })} withBar={false} text="misc.cancel" />
                <BsmButton typeColor="primary" className="rounded-md text-center transition-all flex justify-center items-center" onClick={() => resolver({ exitCode: ModalExitCode.COMPLETED })} withBar={false} text={t("modals.link-contents.valid-btn", { contentType: t(`misc.${contentType}`).toLowerCase() })} />
            </div>
        </form>
    );
};
