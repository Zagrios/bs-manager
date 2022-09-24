export function useBestTextColor(bgHex: string): string{

    return (() => {
        const hex = bgHex.replaceAll("#", "");
        const uicolors = [parseInt(hex.substring(0, 2), 16) / 255, parseInt(hex.substring(0, 2), 16) / 255, parseInt(hex.substring(0, 2), 16) / 255];
        const c = uicolors.map(col => {
            if (col <= 0.03928) { return col / 12.92; }
            return (col + 0.055) / 1.055 ** 2.4;
        });
        const L = (0.2126 * c[0]) + (0.7152 * c[1]) + (0.0722 * c[2]);
        return (L > 0.255) ? "#000" : "fff";
    })();
    
}