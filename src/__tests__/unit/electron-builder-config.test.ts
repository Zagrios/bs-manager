describe("electron-builder signing configuration", () => {
    const originalCscLink = process.env.CSC_LINK;
    const originalWinCscLink = process.env.WIN_CSC_LINK;
    const originalSkipSigning = process.env.SKIP_SIGNING;

    afterEach(() => {
        if (originalCscLink === undefined) delete process.env.CSC_LINK;
        else process.env.CSC_LINK = originalCscLink;
        if (originalWinCscLink === undefined) delete process.env.WIN_CSC_LINK;
        else process.env.WIN_CSC_LINK = originalWinCscLink;
        if (originalSkipSigning === undefined) delete process.env.SKIP_SIGNING;
        else process.env.SKIP_SIGNING = originalSkipSigning;
        jest.resetModules();
    });

    it("lets electron-builder load the certificate file when CSC_LINK is provided", () => {
        process.env.CSC_LINK = "base64-encoded-certificate";
        delete process.env.WIN_CSC_LINK;
        delete process.env.SKIP_SIGNING;

        const config = require("../../../electron-builder.config.js");

        expect(config.win.signtoolOptions).toEqual({
            signingHashAlgorithms: ["sha256"],
        });
    });

    it("ignores an empty certificate link", () => {
        process.env.CSC_LINK = "   ";
        delete process.env.WIN_CSC_LINK;
        delete process.env.SKIP_SIGNING;

        const config = require("../../../electron-builder.config.js");

        expect(config.win.signtoolOptions.certificateSha1).toBe("d55f8cda15bd9cba76ea796b9504860b16c7f46e");
    });

    it("uses the Windows certificate store when no certificate link is provided", () => {
        delete process.env.CSC_LINK;
        delete process.env.WIN_CSC_LINK;
        delete process.env.SKIP_SIGNING;

        const config = require("../../../electron-builder.config.js");

        expect(config.win.signtoolOptions.certificateSha1).toBe("d55f8cda15bd9cba76ea796b9504860b16c7f46e");
    });
});
