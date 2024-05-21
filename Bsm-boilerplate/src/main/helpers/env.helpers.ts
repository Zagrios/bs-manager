import { ProviderPlatform } from "shared/models/provider-platform.enum";

export function execOnOs<T>(executions: { [key in ProviderPlatform]?: () => T }, noError = false): T {
    if(executions[process.platform as ProviderPlatform]) {
        return executions[process.platform as ProviderPlatform]();
    }

    if(!noError) {
        throw new Error(`No execution found for platform ${process.platform}`);
    }

    return undefined;
}