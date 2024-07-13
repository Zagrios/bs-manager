import { I18nService } from "renderer/services/i18n.service";
import { useService } from "./use-service.hook";
import { useObservable } from "./use-observable.hook";

export function useTranslation(): (translationKey: string, args?: Record<string, string>) => string {

    const i18nService = useService(I18nService);

    useObservable(() => i18nService.currentLanguage$);

    return (key: string, args?: Record<string, string>) => {
        if (!key) {
            return key;
        }
        return i18nService.translate(key, args);
    };
}
