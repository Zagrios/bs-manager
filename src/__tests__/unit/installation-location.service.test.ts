import { InstallationLocationService } from "main/services/installation-location.service";
import { arePathsSameFileSystemLocation, copyDirectoryWithJunctions, deleteFolder, resolveExistingFolder } from "main/helpers/fs.helpers";
import path from "path";
import { CustomError } from "shared/models/exceptions/custom-error.class";

const mockRootPath = path.parse(process.cwd()).root;
const mockDocumentsPath = path.join(mockRootPath, "Users", "Test");
const mockDefaultInstallationParentPath = process.platform === "linux"
    ? process.env.XDG_DATA_HOME || path.join(process.env.HOME ?? mockDocumentsPath, ".local", "share")
    : mockDocumentsPath;
const mockCurrentInstallationPath = path.join(mockDefaultInstallationParentPath, "BSManager");
const mockSetupParentPath = path.join(mockRootPath, "New");
const mockSetupInstallationPath = path.join(mockSetupParentPath, "BSManager");
const mockGamesParentPath = path.join(mockRootPath, "Games");
const mockGamesInstallationPath = path.join(mockGamesParentPath, "BSManager");
const mockAliasParentPath = path.join(mockRootPath, "Alias");
const mockAliasInstallationPath = path.join(mockAliasParentPath, "BSManager");

const mockStaticConfig = {
    $watch: jest.fn(() => ({ subscribe: jest.fn() })),
    get: jest.fn(),
    has: jest.fn(() => false),
    set: jest.fn(),
};

jest.mock("electron", () => ({
    app: {
        getPath: jest.fn(() => mockDocumentsPath),
    },
}));
jest.mock("main/services/static-configuration.service", () => ({
    StaticConfigurationService: {
        getInstance: () => mockStaticConfig,
    },
}));
jest.mock("main/helpers/fs.helpers", () => ({
    arePathsSameFileSystemLocation: jest.fn(),
    copyDirectoryWithJunctions: jest.fn(),
    deleteFolder: jest.fn(),
    ensureFolderExist: jest.fn(),
    resolveExistingFolder: jest.fn(),
}));
jest.mock("fs-extra", () => ({
    pathExistsSync: jest.fn(() => false),
}));

const mockResolveExistingFolder = resolveExistingFolder as jest.MockedFunction<typeof resolveExistingFolder>;
const mockCopyDirectoryWithJunctions = copyDirectoryWithJunctions as jest.MockedFunction<typeof copyDirectoryWithJunctions>;
const mockArePathsSameFileSystemLocation = arePathsSameFileSystemLocation as jest.MockedFunction<typeof arePathsSameFileSystemLocation>;
const mockDeleteFolder = deleteFolder as jest.MockedFunction<typeof deleteFolder>;

describe("InstallationLocationService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (InstallationLocationService as unknown as { instance?: InstallationLocationService }).instance = undefined;
        mockStaticConfig.get.mockReset();
        mockStaticConfig.has.mockReset().mockReturnValue(false);
        mockStaticConfig.set.mockReset().mockResolvedValue(undefined);
        mockCopyDirectoryWithJunctions.mockReset().mockResolvedValue(undefined);
        mockDeleteFolder.mockReset().mockResolvedValue(undefined);
        mockArePathsSameFileSystemLocation.mockResolvedValue(false);
    });

    it("refuses to change the installation folder when the submitted path is invalid", async () => {
        mockResolveExistingFolder.mockRejectedValue(new CustomError("Invalid folder path", "INVALID_FOLDER"));
        const service = InstallationLocationService.getInstance();

        await expect(service.setInstallationDirectory(path.join(mockRootPath, "missing"), true)).rejects.toMatchObject({ code: "INVALID_FOLDER" });

        expect(mockStaticConfig.set).not.toHaveBeenCalled();
    });

    it("allows setup to configure its not-yet-created installation folder", async () => {
        mockResolveExistingFolder.mockRejectedValue(new CustomError("Invalid folder path", "INVALID_FOLDER"));
        const service = InstallationLocationService.getInstance();

        await expect(service.setInstallationDirectory(mockSetupInstallationPath, false)).resolves.toBe(mockSetupInstallationPath);

        expect(mockResolveExistingFolder).not.toHaveBeenCalled();
        expect(mockStaticConfig.set).toHaveBeenCalledWith("installation-folder", mockSetupParentPath);
    });

    it("keeps moving the existing installation when a valid path is applied", async () => {
        mockResolveExistingFolder.mockResolvedValue(mockGamesParentPath);
        const service = InstallationLocationService.getInstance();

        await expect(service.setInstallationDirectory(` ${mockGamesParentPath} `, true)).resolves.toBe(mockGamesInstallationPath);

        expect(mockResolveExistingFolder).toHaveBeenCalledWith(` ${mockGamesParentPath} `);
        expect(mockCopyDirectoryWithJunctions).toHaveBeenCalledWith(mockCurrentInstallationPath, mockGamesInstallationPath, { overwrite: true });
        expect(mockStaticConfig.set).toHaveBeenCalledWith("installation-folder", mockGamesParentPath);
    });

    it("does not copy the installation onto itself when the current folder is submitted", async () => {
        mockResolveExistingFolder.mockResolvedValue(mockGamesInstallationPath);
        mockArePathsSameFileSystemLocation.mockResolvedValue(true);
        mockStaticConfig.has.mockReturnValue(true);
        mockStaticConfig.get.mockReturnValue(mockGamesParentPath);
        const service = InstallationLocationService.getInstance();

        await expect(service.setInstallationDirectory(mockGamesInstallationPath, true)).resolves.toBe(mockGamesInstallationPath);

        expect(mockCopyDirectoryWithJunctions).not.toHaveBeenCalled();
        expect(mockStaticConfig.set).toHaveBeenCalledWith("installation-folder", mockGamesParentPath);
    });

    it("does not copy when a filesystem alias points to the current installation", async () => {
        mockResolveExistingFolder.mockResolvedValue(mockAliasParentPath);
        mockArePathsSameFileSystemLocation.mockResolvedValue(true);
        mockStaticConfig.has.mockReturnValue(true);
        mockStaticConfig.get.mockReturnValue(mockGamesParentPath);
        const service = InstallationLocationService.getInstance();

        await service.setInstallationDirectory(mockAliasParentPath, true);

        expect(mockArePathsSameFileSystemLocation).toHaveBeenCalledWith(mockGamesInstallationPath, mockAliasInstallationPath);
        expect(mockCopyDirectoryWithJunctions).not.toHaveBeenCalled();
    });

    it("waits for the destination persistence before deleting the source folder", async () => {
        mockResolveExistingFolder.mockResolvedValue(mockGamesParentPath);
        let finishPersistence: () => void;
        let persistenceStarted: () => void;
        const persistenceStartPromise = new Promise<void>(resolve => {
            persistenceStarted = resolve;
        });
        mockStaticConfig.set.mockImplementation(() => new Promise<void>(resolve => {
            persistenceStarted();
            finishPersistence = resolve;
        }));
        const service = InstallationLocationService.getInstance();

        const movePromise = service.setInstallationDirectory(mockGamesParentPath, true);
        await persistenceStartPromise;

        expect(mockDeleteFolder).not.toHaveBeenCalled();
        finishPersistence!();
        await movePromise;
        expect(mockDeleteFolder).toHaveBeenCalledWith(mockCurrentInstallationPath);
        expect(mockStaticConfig.set).toHaveBeenCalledWith("installation-folder", mockGamesParentPath);
    });

    it("does not delete the source folder when persisting the destination fails", async () => {
        mockResolveExistingFolder.mockResolvedValue(mockGamesParentPath);
        const persistenceError = new Error("Could not persist installation folder");
        const persistenceFailure = Promise.reject(persistenceError);
        mockStaticConfig.set.mockReturnValue(persistenceFailure);
        const service = InstallationLocationService.getInstance();

        await expect(service.setInstallationDirectory(mockGamesParentPath, true)).rejects.toBe(persistenceError);

        expect(mockDeleteFolder).not.toHaveBeenCalled();
        expect(service.installationDirectory()).toBe(mockCurrentInstallationPath);
    });
});
