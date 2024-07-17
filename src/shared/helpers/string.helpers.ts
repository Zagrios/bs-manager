const HashAlgorithmsLengths = {
    sha1: 40,
} as const;

export function findHashInString(str: string, algorithm: keyof typeof HashAlgorithmsLengths = 'sha1'): string | undefined {

    if(!str) { return undefined; }

    const hashLength = HashAlgorithmsLengths[algorithm];
    const regex = new RegExp(`[a-fA-F0-9]{${hashLength}}`, "g");
    const match = regex.exec(str);
    return match ? match[0] : undefined;
}
