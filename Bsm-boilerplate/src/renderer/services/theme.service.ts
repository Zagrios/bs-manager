import { DefaultConfigKey, ThemeConfig } from "renderer/config/default-configuration.config";
import { Observable } from "rxjs";
import { ConfigurationService } from "./configuration.service";

export class ThemeService {
    private static instance: ThemeService;

    private readonly configService: ConfigurationService;

    public readonly theme$: Observable<ThemeConfig>;

    public static getInstance(): ThemeService {
        if (!ThemeService.instance) {
            ThemeService.instance = new ThemeService();
        }
        return ThemeService.instance;
    }

    private constructor() {
        this.configService = ConfigurationService.getInstance();
        this.theme$ = this.configService.watch<ThemeConfig>("theme" as DefaultConfigKey);
    }

    public setTheme(theme: ThemeConfig): void {
        this.configService.set("theme" as DefaultConfigKey, theme);
    }

    public getTheme(): ThemeConfig {
        return this.configService.get("theme" as DefaultConfigKey);
    }

    public getBsmColors(): [string, string]{
        return [this.configService.get("first-color" as DefaultConfigKey), this.configService.get("second-color" as DefaultConfigKey)];
    }

    public get isLight() {
        return this.configService.get("theme" as DefaultConfigKey) === ("light" as ThemeConfig);
    }
    public get isDark() {
        return this.configService.get("theme" as DefaultConfigKey) === ("dark" as ThemeConfig);
    }
    public get isOS() {
        return this.configService.get("theme" as DefaultConfigKey) === ("os" as ThemeConfig);
    }
}
