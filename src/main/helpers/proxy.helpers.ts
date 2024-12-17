import log from 'electron-log';
import Winreg from 'winreg';
import { bootstrap } from 'global-agent';

export function configureProxy() {
    if (process.platform === "win32") {
        configureWindowsProxy();
    } else {
        log.info('configureProxy: Unsupported platform');
    }
}

async function configureWindowsProxy() {
    if (await getWindowsProxy()){
        bootstrap();
        log.info(`Using system proxy: ${process.env.GLOBAL_AGENT_HTTP_PROXY}`);
    }
}

function getWindowsProxy() {
    return new Promise((resolve, reject) => {
        const regKey = new Winreg({
            hive: Winreg.HKCU,
            key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'
        });

        regKey.get('ProxyEnable', (err, result) => {
            if (err) {
                log.error('Error accessing registry for ProxyEnable: ', err);
                resolve(false);
            }

            // ProxyEnable = 1 means proxy is enabled, 0 means it's disabled
            if (parseInt(result.value) !== 1) {
                log.info('Proxy Enabled: false');
                resolve(false);
            } else {
                log.info('Proxy Enabled: true');

                regKey.get('ProxyServer', (err, result) => {
                    if (err) {
                        log.error('Error accessing registry for ProxyServer: ', err);
                        resolve(false);
                    }

                    const httpProxyUrl = `http://${result.value}`
                    process.env.GLOBAL_AGENT_HTTP_PROXY = httpProxyUrl;
                    process.env.GLOBAL_AGENT_HTTPS_PROXY = httpProxyUrl;

                    log.info('Proxy Server: ', httpProxyUrl);

                    regKey.get('ProxyOverride', (err, result) => {
                        if (err) {
                            log.error('Error accessing registry for ProxyOverride: ', err);
                            resolve(false);
                        }

                        process.env.GLOBAL_AGENT_NO_PROXY = result.value;

                        log.info('Proxy Override: ', result.value);

                        resolve(true);
                    });
                });
            }
        });
    });
}
