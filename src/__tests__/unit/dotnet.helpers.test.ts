import { COMIMAGE_FLAGS_32BITREQUIRED, setDotNet32BitRequired } from "main/helpers/dotnet.helpers";

const PE_OFFSET = 0x80;
const OPTIONAL_HEADER_OFFSET = PE_OFFSET + 24;
const OPTIONAL_HEADER_SIZE = 224;
const SECTION_TABLE_OFFSET = OPTIONAL_HEADER_OFFSET + OPTIONAL_HEADER_SIZE;
const SECTION_VA = 0x2000;
const SECTION_RAW = 0x200;
const CLR_HEADER_RVA = 0x2008;
const FLAGS_FILE_OFFSET = CLR_HEADER_RVA - SECTION_VA + SECTION_RAW + 16;

function createPe32Image({ clrHeaderRva = CLR_HEADER_RVA, flags = 0x1 } = {}): Buffer {
    const data = Buffer.alloc(0x400);
    data.writeUInt32LE(PE_OFFSET, 0x3c);
    data.writeUInt32LE(0x00004550, PE_OFFSET);
    data.writeUInt16LE(1, PE_OFFSET + 6); // section count
    data.writeUInt16LE(OPTIONAL_HEADER_SIZE, PE_OFFSET + 20);
    data.writeUInt16LE(0x10b, OPTIONAL_HEADER_OFFSET); // PE32
    data.writeUInt32LE(clrHeaderRva, OPTIONAL_HEADER_OFFSET + 96 + 14 * 8);
    data.writeUInt32LE(0x1000, SECTION_TABLE_OFFSET + 8); // virtual size
    data.writeUInt32LE(SECTION_VA, SECTION_TABLE_OFFSET + 12);
    data.writeUInt32LE(SECTION_RAW, SECTION_TABLE_OFFSET + 20);
    data.writeUInt32LE(flags, FLAGS_FILE_OFFSET);
    return data;
}

describe("setDotNet32BitRequired", () => {
    it("sets the 32BITREQUIRED flag and keeps existing flags", () => {
        const result = setDotNet32BitRequired(createPe32Image({ flags: 0x1 }));
        expect(result.readUInt32LE(FLAGS_FILE_OFFSET)).toBe(0x1 | COMIMAGE_FLAGS_32BITREQUIRED);
    });

    it("does not modify the input buffer", () => {
        const input = createPe32Image({ flags: 0x1 });
        setDotNet32BitRequired(input);
        expect(input.readUInt32LE(FLAGS_FILE_OFFSET)).toBe(0x1);
    });

    it("throws for images without a CLR header", () => {
        expect(() => setDotNet32BitRequired(createPe32Image({ clrHeaderRva: 0 }))).toThrow("Not a .NET assembly");
    });

    it("throws for non-PE data", () => {
        expect(() => setDotNet32BitRequired(Buffer.alloc(0x400))).toThrow("Invalid PE signature");
    });
});
