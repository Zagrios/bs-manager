export function isOculusTokenValid(token: string, logger?: (...args: unknown[]) => void): boolean{

    // Part of code taken from "https://github.com/ComputerElite/QuestAppVersionSwitcher" (TokenTools.cs)

    logger?.("Checking if Oculus user token is valid");

    if(!token){
        logger?.("Oculus user token is empty");
        return false;
    }
    if(token.includes("%")){
        logger?.("Token contains %. Token most likely comes from an uri and won't work");
        return false;
    }
    if(!token.startsWith("FRL") && !token.startsWith("OC") ){
        logger?.("Tokens must start with 'FRL' or 'OC'.");
        return false;
    }
    if(token.includes("|")){
        logger?.("Token contains '|' which usually indicates an application token which is not valid for user tokens");
        return false;
    }
    if(token.includes(":")){
        logger?.("Token contains ':' wich can indicate that the user have copied the 'access_token' field with the token");
        return false;
    }
    if(token.match(/OC\d{15}/)){
        logger?.("Token matches /OC[0-9}{15}/ which usually indicates a changed oculus store token");
        return false;
    }

    logger?.("Oculus user token is valid.", `token lenght : ${token.length}`);

    return true;

}
