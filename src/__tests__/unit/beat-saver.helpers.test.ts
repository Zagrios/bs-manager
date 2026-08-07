import { formatBsrCode, parseBsrCode } from "shared/helpers/beat-saver.helpers";

describe("BeatSaver helpers", () => {
    it("formats a BSR code", () => {
        expect(formatBsrCode("5346e")).toBe("!bsr 5346e");
    });

    it.each([
        ["!bsr 5346e", "5346e"],
        ["  !BSR   5346e  ", "5346e"],
        ["Jinsei Matatabi", undefined],
        ["!bsr 5346e extra", undefined],
    ])("parses %p as %p", (value, expected) => {
        expect(parseBsrCode(value)).toBe(expected);
    });
});
