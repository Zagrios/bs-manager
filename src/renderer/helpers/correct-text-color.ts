import Color from "color";

/**
 * Return text color for best constrast with background color
 * @param {string} bgHex 
 * @returns {string}
 */
export function getCorrectTextColor(bgHex: string): string{
    if(!bgHex){ return "#000"; }
    const color = Color(bgHex);
    return color.isLight() ? "#000" : "#fff";
}