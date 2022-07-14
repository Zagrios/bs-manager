import { I18nService } from "renderer/services/i18n.service"

export function useTranslation(): (translationKey: string) => string{
   
   const i18nService = I18nService.getInstance();

   return (key: string) => {
      if(!key){ return ""; }
      const tranlatables = key.split(" ");
      return tranlatables.map((key) => i18nService.translate(key)).join(" ");
   }
}