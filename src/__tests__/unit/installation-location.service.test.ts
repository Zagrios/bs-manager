import { InstallationLocationService } from "main/services/installation-location.service";
import { arePathsSameFileSystemLocation, copyDirectoryWithJunctions, deleteFolder, resolveExistingFolder } from "main/helpers/fs.helpers";
import { CustomError } from "shared/models/exceptions/custom-error.class";

const mockStaticConfig = {
    $watch: jest.fn(() => ({ subscribe: jest.fn() })),
    get: jest.fn(),
    has: jest.fn(() => false),
    set: jest.fn(),
};

jest.mock("electron", () => ({
    app: {
        getPath: jest.fn(() => "C:\\Users\\Test"),
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
        mockArePathsSameFileSystemLocation.mockResolvedValue(false);
    });

    it("refuses to change the installation folder when the submitted path is invalid", async () => {
        mockResolveExistingFolder.mockRejectedValue(new CustomError("Invalid folder path", "INVALID_FOLDER"));
        const service = InstallationLocationService.getInstance();

        await expect(service.setInstallationDirectory("C:\\missing", true)).rejects.toMatchObject({ code: "INVALID_FOLDER" });

        expect(mockStaticConfig.set).not.toHaveBeenCalled();
    });

    it("allows setup to configure its not-yet-created installation folder", async () => {
        mockResolveExistingFolder.mockRejectedValue(new CustomError("Invalid folder path", "INVALID_FOLDER"));
        const service = InstallationLocationService.getInstance();

        await expect(service.setInstallationDirectory("C:\\New\\BSManager", false)).resolves.toBe("C:\\New\\BSManager");

        expect(mockResolveExistingFolder).not.toHaveBeenCalled();
        expect(mockStaticConfig.set).toHaveBeenCalledWith("installation-folder", "C:\\New");
    });

    it("keeps moving the existing installation when a valid path is applied", async () => {
        mockResolveExistingFolder.mockResolvedValue("D:\\Games");
        const service = InstallationLocationService.getInstance();

        await expect(service.setInstallationDirectory(" D:\\Games ", true)).resolves.toBe("D:\\Games\\BSManager");

        expect(mockResolveExistingFolder).toHaveBeenCalledWith(" D:\\Games ");
        expect(mockCopyDirectoryWithJunctions).toHaveBeenCalledWith("C:\\Users\\Test\\BSManager", "D:\\Games\\BSManager", { overwrite: true });
        expect(mockStaticConfig.set).toHaveBeenCalledWith("installation-folder", "D:\\Games");
    });

    it("does not copy the installation onto itself when the current folder is submitted", async () => {
        mockResolveExistingFolder.mockResolvedValue("D:\\Games\\BSManager");
        mockArePathsSameFileSystemLocation.mockResolvedValue(true);
        mockStaticConfig.has.mockReturnValue(true);
        mockStaticConfig.get.mockReturnValue("D:\\Games");
        const service = InstallationLocationService.getInstance();

        await expect(service.setInstallationDirectory("D:\\Games\\BSManager", true)).resolves.toBe("D:\\Games\\BSManager");

        expect(mockCopyDirectoryWithJunctions).not.toHaveBeenCalled();
        expect(mockStaticConfig.set).toHaveBeenCalledWith("installation-folder", "D:\\Games");
    });

    it("does not copy when a filesystem alias points to the current installation", async () => {
        mockResolveExistingFolder.mockResolvedValue("D:\\Alias");
        mockArePathsSameFileSystemLocation.mockResolvedValue(true);
        mockStaticConfig.has.mockReturnValue(true);
        mockStaticConfig.get.mockReturnValue("D:\\Games");
        const service = InstallationLocationService.getInstance();

        await service.setInstallationDirectory("D:\\Alias", true);

        expect(mockArePathsSameFileSystemLocation).toHaveBeenCalledWith("D:\\Games\\BSManager", "D:\\Alias\\BSManager");
        expect(mockCopyDirectoryWithJunctions).not.toHaveBeenCalled();
    });

    it("waits for the source folder deletion before persisting the new location", async () => {
        mockResolveExistingFolder.mockResolvedValue("D:\\Games");
        let finishDeletion: () => void;
        let deletionStarted: () => void;
        const deletionStartPromise = new Promise<void>(resolve => {
            deletionStarted = resolve;
        });
        mockDeleteFolder.mockImplementation(() => new Promise(resolve => {
            deletionStarted();
            finishDeletion = resolve;
        }));
        const service = InstallationLocationService.getInstance();

        const movePromise = service.setInstallationDirectory("D:\\Games", true);
        await deletionStartPromise;

        expect(mockStaticConfig.set).not.toHaveBeenCalled();
        finishDeletion!();
        await movePromise;
        expect(mockStaticConfig.set).toHaveBeenCalledWith("installation-folder", "D:\\Games");
    });
});
