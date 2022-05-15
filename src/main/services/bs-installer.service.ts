import path from "path";
import { BSVersionManagerService } from "./bs-version-manager.service";
import { UtilsService } from "./utils.service";

export class BSInstallerService{

  private static readonly INSTALLATION_FOLDER = "BSManager";

  private static instance: BSInstallerService;

  private readonly utils: UtilsService = UtilsService.getInstance();

  private installationFolder: string;

  private constructor(){
    this.installationFolder = path.join(this.utils.getUserDocumentsFolder(), BSInstallerService.INSTALLATION_FOLDER)
  }

  public static getInstance(){
    if(!BSInstallerService.instance){ BSInstallerService.instance = new BSInstallerService(); }
    return BSInstallerService.instance;
  }

  public getBSInstallationFolder(): string{ return this.installationFolder; }




}
