const BSR_COMMAND = "!bsr";

export function formatBsrCode(mapId: string): string {
    return `${BSR_COMMAND} ${mapId}`;
}

export function parseBsrCode(value?: string): string | undefined {
    const [command, mapId, ...extraParts] = value?.trim().split(/\s+/) ?? [];

    if (command?.toLowerCase() !== BSR_COMMAND || !mapId || extraParts.length > 0) {
        return undefined;
    }

    return mapId;
}
