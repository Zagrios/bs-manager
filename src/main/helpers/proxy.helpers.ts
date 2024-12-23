import log from 'electron-log';
import { RegDwordValue, RegSzValue } from "regedit-rs"
import { execOnOs } from "../helpers/env.helpers";
import { bootstrap } from 'global-agent';

const { list } = (execOnOs({ win32: () => require("regedit-rs") }, true) ?? {}) as typeof import("regedit-rs");

async function isProxyEnabled(): Promise<boolean>{
    const res = await list("HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings");
    const key = res["HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"];
    if(!key.exists){ throw new Error("Key \"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\" not exist"); }
    const registryValue = key.values.ProxyEnable as RegDwordValue;
    if(!registryValue){ throw new Error("Value \"ProxyEnable\" not exist"); }
    return (1 === registryValue.value) ? true : false;
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

async function configureWindowsProxy() : Promise<void> {
    if (await isProxyEnabled().catch(err => log.error(err))) {
        const httpProxyUrl = `http://${await getProxyServer().catch(err => log.error(err))}`
        process.env.GLOBAL_AGENT_HTTP_PROXY = httpProxyUrl;
        process.env.GLOBAL_AGENT_HTTPS_PROXY = httpProxyUrl;

        process.env.GLOBAL_AGENT_NO_PROXY = `${await getProxyOverride().catch(err => log.error(err))}`;

        log.info(`configureWindowsProxy: Using system proxy: ${process.env.GLOBAL_AGENT_HTTP_PROXY}`);

        bootstrap();
    }
    else {
        log.info(`configureWindowsProxy: System proxy not detected`);
    }
}

export function configureProxy() {
    if (process.platform === "win32") {
        configureWindowsProxy();
    } else {
        log.info('configureProxy: Unsupported platform');
    }
}
