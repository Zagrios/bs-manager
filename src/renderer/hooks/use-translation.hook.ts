import { I18nService } from "renderer/services/i18n.service"

export function useTranslation(): (translationKey: string, args?: Record<string, string>) => string{
   
   const i18nService = I18nService.getInstance();

   return (key: string, args?: Record<string, string>) => {
      const tranlatables = key.split(" ");
      return tranlatables.map((key) => i18nService.translate(key, args)).join(" ");
   }
}