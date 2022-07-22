import { useEffect, useState } from "react";
import { ConfigurationService } from "renderer/services/configuration.service";

export function useThemeColor(themeColor: "first-color"|"second-color"){
   const configService = ConfigurationService.getInstance();

   const [color, setColor] = useState("");

   useEffect(() => {
      const obs = configService.watch<string>(themeColor)
      obs.subscribe(color => {
         setColor(color);
      })
      return () => {
         configService.stopWatch(color, obs);
         obs.unsubscribe();
      }
   }, []);

   return color;
   
}