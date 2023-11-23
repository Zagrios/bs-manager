export function isOculusTokenValid(token: string, logger?: (...args: unknown[]) => void): boolean{

    // Code taken from "https://github.com/ComputerElite/QuestAppVersionSwitcher" (TokenTools.cs)

    logger?.("Checking if Oculus user token is valid");

    if(!token){
        logger?.("Oculus user token is empty");
        return false;
    }
    if(token.includes("%")){
        logger?.("Token contains %. Token most likely comes from an uri and won't work");
        return false;
    }
    if(!token.startsWith("OC")){
        logger?.("Token does not start with OC.");
        return false;
    }
    if(token.includes("|")){
        logger?.("Token contains | which usually indicates an application token which is not valid for user tokens");
        return false;
    }
    if(token.match(/OC\d{15}/)){
        logger?.("Token matches /OC[0-9}{15}/ which usually indicates a changed oculus store token");
        return false;
    }

    logger?.("Oculus user token is valid");

    return true;

}