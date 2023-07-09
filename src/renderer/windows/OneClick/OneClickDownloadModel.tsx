import { useEffect, useState } from "react";
import { BsmProgressBar } from "renderer/components/progress-bar/bsm-progress-bar.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import TitleBar from "renderer/components/title-bar/title-bar.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { IpcService } from "renderer/services/ipc.service";
import { NotificationService } from "renderer/services/notification.service";
import { ProgressBarService } from "renderer/services/progress-bar.service";
import { ThemeService } from "renderer/services/theme.service";
import { ModelSaberService } from "renderer/services/thrird-partys/model-saber.service";
import { WindowManagerService } from "renderer/services/window-manager.service";
import { MSModel } from "shared/models/models/model-saber.model";
import defaultImage from "../../../../assets/images/default-version-img.jpg";
import { ModelsDownloaderService } from "renderer/services/models-management/models-downloader.service";
import { useService } from "renderer/hooks/use-service.hook";

export default function OneClickDownloadModel() {
    const ipc = useService(IpcService);
    const themeService = useService(ThemeService);
    const modelSaber = useService(ModelSaberService);
    const progress = useService(ProgressBarService);
    const modelDownloader = useService(ModelsDownloaderService);
    const windows = useService(WindowManagerService);
    const notification = useService(NotificationService);

    const [model, setModel] = useState<MSModel>(null);
    const t = useTranslation();

    const cover = model ? model.thumbnail : null;
    const title = model ? model.name : null;

    useEffect(() => {
        const sub = themeService.theme$.subscribe(() => {
            if (themeService.isDark || (themeService.isOS && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
                document.documentElement.classList.add("dark");
            } else {
                document.documentElement.classList.remove("dark");
            }
        });

        const promise = new Promise(async (resolve, reject) => {
            const infos = await ipc.send<{ id: string; type: string }>("one-click-model-info");

            if (!infos.success) {
                return reject();
            }

            const model = await modelSaber.getModelById(infos.data.id);

            if (!model) {
                return reject();
            }

            setModel(() => model);

            progress.open();

            const res = await modelDownloader.oneClickInstallModel(model);

            if (!res) {
                return reject();
            }

            resolve(res);
        });

        promise.catch(() => {
            notification.notifySystem({ title: t("notifications.types.error"), body: t("notifications.models.one-click-install.error") });
        });

        promise.then(() => {
            notification.notifySystem({ title: "OneClick", body: t("notifications.models.one-click-install.success") });
        });

        promise.finally(() => windows.close("oneclick-download-model.html"));

        return () => {
            sub.unsubscribe();
        };
    }, []);

    return (
        <div className="relative w-screen h-screen overflow-hidden">
            {cover && <BsmImage className="absolute top-0 left-0 w-full h-full object-cover" image={cover} />}
            <div className="w-full h-full backdrop-brightness-50 backdrop-blur-md flex flex-col justify-start items-center gap-10">
                <TitleBar template="oneclick-download-model.html" />
                <BsmImage className="aspect-[1/1] w-1/2 object-cover rounded-md shadow-black shadow-lg" placeholder={defaultImage} image={cover} errorImage={defaultImage} />
                <h1 className="overflow-hidden font-bold italic text-xl text-gray-200 tracking-wide w-full text-center whitespace-nowrap text-ellipsis px-2">{title}</h1>
            </div>
            <BsmProgressBar />
        </div>
    );
}
