/* eslint-disable no-redeclare */
import { DefaultConfigKey } from "renderer/config/default-configuration.config";
import { ConfigurationService } from "renderer/services/configuration.service";
import { useObservable } from "./use-observable.hook";
import { useService } from "./use-service.hook";
import { of, throttleTime } from "rxjs";

export function useThemeColor(): { firstColor: string; secondColor: string };
export function useThemeColor(themeColor: ThemeColor): string;
export function useThemeColor(themeColor?: ThemeColor): string | { firstColor: string; secondColor: string } {
    const configService = useService(ConfigurationService);

    const firstColor = useObservable(() => !themeColor ? configService.watch<string>("first-color" as DefaultConfigKey).pipe(throttleTime(16)) : configService.watch<string>(themeColor).pipe(throttleTime(16)));
    const secondColor = useObservable(() => !themeColor ? configService.watch<string>("second-color" as DefaultConfigKey).pipe(throttleTime(16)) : of(""));

    if (themeColor) {
        return firstColor;
    }

    return { firstColor, secondColor };
}

export type ThemeColor = "first-color" | "second-color";
