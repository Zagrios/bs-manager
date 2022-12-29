import { useEffect, useState } from "react";
import { DefaultConfigKey } from "renderer/config/default-configuration.config";
import { ConfigurationService } from "renderer/services/configuration.service";

export function useThemeColor(): {firstColor: string, secondColor: string};
export function useThemeColor(themeColor: ThemeColor): string;
export function useThemeColor(themeColor?: ThemeColor): string|{firstColor: string, secondColor: string}{
   const configService = ConfigurationService.getInstance();

   if(themeColor){
      const [color, setColor] = useState("");

      useEffect(() => {
         const sub = configService.watch<string>(themeColor).subscribe(color => {
            setColor(color);
         })
         return () => {
            sub.unsubscribe();
         }
      }, []);

      return color;
   }
   
   const [firstColor, setFirstColor] = useState("");
   const [secondColor, setSecondColor] = useState("");

   useEffect(() => {
      const sub1 = configService.watch<string>("first-color" as DefaultConfigKey).subscribe(color => {
         setFirstColor(color);
      });
      const sub2 = configService.watch<string>("second-color" as DefaultConfigKey).subscribe(color => {
         setSecondColor(color);
      });
      return () => {
         sub1.unsubscribe();
         sub2.unsubscribe();
      }
   }, []);

   return {firstColor, secondColor}
   
}

export type ThemeColor = "first-color"|"second-color";