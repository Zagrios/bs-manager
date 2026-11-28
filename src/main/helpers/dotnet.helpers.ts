const PE_HEADER_OFFSET_POINTER = 0x3c;
const PE_SIGNATURE = 0x00004550; // "PE\0\0"
const PE32_MAGIC = 0x10b;
const PE32_PLUS_MAGIC = 0x20b;
const CLR_RUNTIME_HEADER_DIRECTORY_INDEX = 14;
const SECTION_HEADER_SIZE = 40;
const COR20_FLAGS_OFFSET = 16;

export const COMIMAGE_FLAGS_32BITREQUIRED = 0x2;

function rvaToFileOffset(data: Buffer, sectionTableOffset: number, sectionCount: number, rva: number): number {
    for (let i = 0; i < sectionCount; ++i) {
        const section = sectionTableOffset + i * SECTION_HEADER_SIZE;
        const virtualSize = data.readUInt32LE(section + 8);
        const virtualAddress = data.readUInt32LE(section + 12);
        const rawDataOffset = data.readUInt32LE(section + 20);
        if (rva >= virtualAddress && rva < virtualAddress + virtualSize) {
            return rva - virtualAddress + rawDataOffset;
        }
    }
    throw new Error(`RVA 0x${rva.toString(16)} is not inside any section`);
}

/**
 * Returns the file offset of the CLR (COR20) header flags of a .NET PE image.
 * Throws if the buffer is not a .NET PE image.
 */
function getCor20FlagsOffset(data: Buffer): number {
    const peOffset = data.readUInt32LE(PE_HEADER_OFFSET_POINTER);
    if (data.readUInt32LE(peOffset) !== PE_SIGNATURE) {
        throw new Error("Invalid PE signature");
    }

    const sectionCount = data.readUInt16LE(peOffset + 6);
    const optionalHeaderSize = data.readUInt16LE(peOffset + 20);
    const optionalHeaderOffset = peOffset + 24;
    const magic = data.readUInt16LE(optionalHeaderOffset);
    if (magic !== PE32_MAGIC && magic !== PE32_PLUS_MAGIC) {
        throw new Error(`Unknown optional header magic 0x${magic.toString(16)}`);
    }

    const dataDirectoriesOffset = optionalHeaderOffset + (magic === PE32_MAGIC ? 96 : 112);
    const clrHeaderRva = data.readUInt32LE(dataDirectoriesOffset + CLR_RUNTIME_HEADER_DIRECTORY_INDEX * 8);
    if (!clrHeaderRva) {
        throw new Error("Not a .NET assembly");
    }

    const sectionTableOffset = optionalHeaderOffset + optionalHeaderSize;
    return rvaToFileOffset(data, sectionTableOffset, sectionCount, clrHeaderRva) + COR20_FLAGS_OFFSET;
}

/**
 * Returns a copy of a .NET PE image with the 32BITREQUIRED flag set
 * (same as `corflags /32BIT+`), forcing it to run as a 32-bit x86 process.
 */
export function setDotNet32BitRequired(data: Buffer): Buffer {
    const result = Buffer.from(data);
    const flagsOffset = getCor20FlagsOffset(result);
    result.writeUInt32LE(result.readUInt32LE(flagsOffset) | COMIMAGE_FLAGS_32BITREQUIRED, flagsOffset);
    return result;
}
