import { CustomError } from "shared/models/exceptions/custom-error.class";
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

enum EnvParserState {
    NAME_START,
    NAME,
    VALUE_START,
    VALUE,
    QUOTE_VALUE,
    DQUOTE_VALUE,
    SPACE,
    ERROR,
};

const isAlphaCharacter = (c: string) =>
    (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
const isNumber = (c: string) => c >= "0" && c <= "9";

export function parseEnvString(envString: string): Record<string, string> {
    const envVars: Record<string, string> = {};

    let state: EnvParserState = EnvParserState.NAME_START;
    let index = 0;
    let newName = "";
    for (let pos = 0; pos < envString.length; ++pos) {
        const c = envString[pos];

        switch (state) {
            case EnvParserState.NAME_START:
                if (isAlphaCharacter(c) || c === "_") {
                    state = EnvParserState.NAME;
                    index = pos;
                } else if (c !== " ") {
                    state = EnvParserState.ERROR;
                }
                break;

            case EnvParserState.NAME:
                if (c === "=") {
                    state = EnvParserState.VALUE_START;
                    newName = envString.substring(index, pos);
                    index = pos + 1;
                } else if (!isAlphaCharacter(c) && !isNumber(c) && c !== "_") {
                    state = EnvParserState.ERROR;
                }
                break;

            case EnvParserState.VALUE_START:
                if (c === "'") {
                    ++index;
                    state = EnvParserState.QUOTE_VALUE;
                } else if (c === '"') {
                    ++index;
                    state = EnvParserState.DQUOTE_VALUE;
                } else if (c === " ") {
                    state = EnvParserState.NAME_START;
                    envVars[newName] = "";
                } else {
                    state = EnvParserState.VALUE;
                }
                break;

            case EnvParserState.VALUE:
                if (c === " ") {
                    state = EnvParserState.NAME_START;
                    envVars[newName] = envString.substring(index, pos);
                }
                break;

            case EnvParserState.QUOTE_VALUE:
                if (c === "'") {
                    state = EnvParserState.SPACE;
                    envVars[newName] = envString.substring(index, pos);
                }
                break;

            case EnvParserState.DQUOTE_VALUE:
                if (c === '"') {
                    state = EnvParserState.SPACE;
                    envVars[newName] = envString.substring(index, pos);
                }
                break;

            case EnvParserState.SPACE:
                if (c === " ") {
                    state = EnvParserState.NAME_START;
                } else {
                    state = EnvParserState.ERROR;
                }
                break;

            default:
        }

        if (state === EnvParserState.ERROR) {
            throw new CustomError(
                `parseEnvString failed: invalid character at position ${pos}`,
                "generic.env.parse"
            );
        }
    }

    if (state === EnvParserState.VALUE_START || state === EnvParserState.VALUE) {
        envVars[newName] = envString.substring(index);
        return envVars;
    }

    if (state === EnvParserState.NAME_START || state === EnvParserState.SPACE) {
        return envVars;
    }

    throw new CustomError(
        "parseEnvString failed: invalid ending state",
        "generic.env.parse"
    );
}
