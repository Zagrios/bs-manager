import log from 'electron-log';
import { RegDwordValue, RegSzValue } from "regedit-rs"
import { execOnOs } from "./env.helpers";
import { bootstrap } from 'global-agent';
import { StaticConfigurationService } from "../services/static-configuration.service";

const staticConfig = StaticConfigurationService.getInstance();

const { list } = (execOnOs({ win32: () => require("regedit-rs") }, true) ?? {}) as typeof import("regedit-rs");

async function isProxyEnabled(): Promise<boolean>{
    const res = await list("HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings");
    const key = res["HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"];
    if(!key.exists){ throw new Error("Key \"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\" not exist"); }
    const registryValue = key.values.ProxyEnable as RegDwordValue;
    if(!registryValue){ throw new Error("Value \"ProxyEnable\" not exist"); }
    return registryValue.value === 1;
}

async function getProxyServer(): Promise<string>{
    const res = await list("HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings");
    const key = res["HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"];
    if(!key.exists){ throw new Error("Key \"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\" not exist"); }
    const registryValue = key.values.ProxyServer as RegSzValue;
    if(!registryValue){ throw new Error("Value \"ProxyServer\" not exist"); }
    return registryValue.value;
}

async function getProxyOverride(): Promise<string>{
    const res = await list("HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings");
    const key = res["HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"];
    if(!key.exists){ throw new Error("Key \"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\" not exist"); }
    const registryValue = key.values.ProxyOverride as RegSzValue;
    if(!registryValue){ throw new Error("Value \"ProxyOverride\" not exist"); }
    return registryValue.value;
}

async function enableWindowsProxy(enable: boolean): Promise<void> {
    if (!(await isProxyEnabled().catch(err => log.error(err)))) {
        log.info("enableWindowsProxy: System proxy not detected");
        return;
    }

    let { GLOBAL_AGENT: globalProxyAgent } = global as any;
    if (!globalProxyAgent) { // If this is undefined, call bootstrap to set it up
        if (!bootstrap()) {
            log.error("enableWindowsProxy: Could not setup proxy stuff");
            return;
        }
        globalProxyAgent = (global as any).GLOBAL_AGENT;
    }

    if (enable) {
        const httpProxyUrl = `http://${await getProxyServer().catch(err => log.error(err))}`
        globalProxyAgent.HTTP_PROXY = httpProxyUrl;
        globalProxyAgent.HTTPS_PROXY = httpProxyUrl;
        globalProxyAgent.NO_PROXY = `${await getProxyOverride().catch(err => log.error(err))}`;

        log.info(`enableWindowsProxy: Using system proxy: ${httpProxyUrl}`);
    } else {
        delete globalProxyAgent.HTTP_PROXY;
        delete globalProxyAgent.HTTPS_PROXY;
        delete globalProxyAgent.NO_PROXY;

        log.info("enableWindowsProxy: proxy disabled");
    }
}

export function configureProxy() {
    if (process.platform === "win32") {
        enableWindowsProxy(staticConfig.get("use-system-proxy"));

        staticConfig.$watch("use-system-proxy").subscribe((useSystemProxy) => {
            enableWindowsProxy(useSystemProxy);

            log.info(`configureProxy: UseSystemProxy is set to ${useSystemProxy}`);
        });
    } else {
        log.info("configureProxy: Unsupported platform");
    }
}
