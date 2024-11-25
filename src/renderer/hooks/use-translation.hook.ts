import { I18nService } from "renderer/services/i18n.service";
import { useService } from "./use-service.hook";
import { useObservable } from "./use-observable.hook";
import { useConstant } from "./use-constant.hook";
import { createElement, Fragment } from "react";

/**
 * @deprecated Use useTranslationV2 instead
 */
export function useTranslation(): (translationKey: string, args?: Record<string, string>) => string {
    
    const i18nService = useService(I18nService);

    useObservable(() => i18nService.currentLanguage$);

    return (key: string, args?: Record<string, string>) => {
        if (!key) {
            return key;
        }
        const tranlatables = key.split(" ");
        return tranlatables.map(key => i18nService.translate(key, args)).join(" ");
    };
}

type TranslateFunctions = {
    text: (translationKey: string, args?: Record<string, string>) => string;
    element: (translationKey: string, args?: Record<string, JSX.Element>) => JSX.Element;
}

export function useTranslationV2(): TranslateFunctions {

    const i18nService = useService(I18nService);

    useObservable(() => i18nService.currentLanguage$);

    const text = useConstant(() => {
        return (key: string, args?: Record<string, string>) => {
            if (!key) {
                return key;
            }
            return i18nService.translate(key, args);
        };
    });

    const element = useConstant(() => {
        return (key: string, args?: Record<string, JSX.Element>) => {
            if (!key) {
                return createElement(Fragment, null, key);
            }
            return i18nService.translateElement(key, args);
        };
    });

    return { text, element };
}
