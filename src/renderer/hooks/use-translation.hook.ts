import { useMemo } from "react";
import { I18nService } from "renderer/services/i18n.service"

export function useTranslation(): (translationKey: string) => string{
    
    const i18nService = I18nService.getInstance();

    return (key: string) => {
        return useMemo(() => i18nService.translate(key), [key, i18nService.currentLanguage]);
    }
}