import { DefaultConfigKey } from "renderer/config/default-configuration.config";
import { distinctUntilChanged, filter, map } from "rxjs/operators";
import { Observable } from "rxjs";
import { ConfigurationService } from "./configuration.service";
import { getProperty } from "dot-prop";
import { i18n } from "dateformat";
import { createElement, Fragment } from "react";

export class I18nService {
    private static instance: I18nService;

    private readonly cache: Map<string, string>;

    private readonly LANG_CONFIG_KEY: DefaultConfigKey = "language";
    private readonly LANG_FALLBACK = "en-EN";

    private readonly configService: ConfigurationService;

    private dictionary = {};

    public static getInstance(): I18nService {
        if (!I18nService.instance) {
            I18nService.instance = new I18nService();
        }
        return I18nService.instance;
    }

    private constructor() {
        this.configService = ConfigurationService.getInstance();
        this.cache = new Map<string, string>();

        this.currentLanguage$
            .pipe(
                filter(l => !!l),
                distinctUntilChanged()
            )
            .subscribe(async lang => {
                this.cache.clear();
                this.dictionary = this.importLang([lang, lang.split("-")[0]], "en");

                i18n.dayNames = getProperty(this.dictionary, "dateformat.dayNames");
                i18n.monthNames = getProperty(this.dictionary, "dateformat.monthNames");
                i18n.timeNames = getProperty(this.dictionary, "dateformat.timeNames");
            });
    }

    private importLang(lang: string[], fallback: string): Record<string, string> {

        for (const l of lang) {
            try {
                return require(`../../../assets/jsons/translations/${l.toLowerCase()}.json`);
            }
            catch (e) {
                continue;
            }
        }

        return require(`../../../assets/jsons/translations/${fallback.toLowerCase()}.json`);
    }

    public getSupportedLanguages(): string[] {
        return this.configService.get("supported_languages" as DefaultConfigKey);
    }
    public getFallbackLanguage(): string {
        return this.LANG_FALLBACK;
    }

    public get currentLanguage(): string {
        return this.getSupportedLanguages().includes(this.configService.get(this.LANG_CONFIG_KEY)) ? this.configService.get(this.LANG_CONFIG_KEY) : this.LANG_FALLBACK;
    }
    public get currentLanguage$(): Observable<string> {
        return this.configService.watch<string>("language" as DefaultConfigKey).pipe(map(l => (this.getSupportedLanguages().includes(l) ? l : this.LANG_FALLBACK)));
    }

    public setLanguage(lang: string) {
        this.configService.set("language" as DefaultConfigKey, this.getSupportedLanguages().includes(lang) ? lang : this.LANG_FALLBACK);
    }

    public translate(translationKey: string, args?: Record<string, string>): string {
        let translated = this.cache.get(translationKey);
        if (!translated) {
            translated = getProperty(this.dictionary, translationKey) ?? translationKey;
            this.cache.set(translationKey, translated);
        }

        if (args) {
            Object.keys(args).forEach(key => {
                translated = translated.replaceAll(`{${key}}`, args[key]);
            });
        }

        return translated;
    }

    public translateElement(translationKey: string, args?: Record<string, JSX.Element>): JSX.Element {
        let translated = this.cache.get(translationKey);
        if (!translated) {
            translated = getProperty(this.dictionary, translationKey) ?? translationKey;
            this.cache.set(translationKey, translated);
        }

        if (!args) {
            return createElement(Fragment, null, translated);
        }

        // Sort keys by length in descending order to avoid partial matches within keys
        const sortedKeys = Object.keys(args).sort((a, b) => b.length - a.length);

        const pattern = sortedKeys.map(key => `\\{${key}\\}`).join('|');
        const regex = new RegExp(`(${pattern})`, 'g');
        const segments = translated.split(regex);

        const children = segments.map((segment) => {
            const key = segment.slice(1, -1); // Remove surrounding {}
            return args[key] || segment;
        });

        return createElement(Fragment, null, ...children);
    }
}
