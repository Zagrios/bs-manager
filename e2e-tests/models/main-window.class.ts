import { Page, Locator } from "playwright"

export class MainWindow {

    protected readonly _page: Page;

    private readonly _bsmLogo: Locator;
    private readonly _addVersionButton: Locator;
    private readonly _settingsButton: Locator;
    private readonly _sharedContentButton: Locator;

    constructor(page: Page) {
        this._page = page;

        this._bsmLogo = page.locator("#bsm-logo");
        this._addVersionButton = page.locator("#add-version-btn");
        this._settingsButton = page.locator("#settings-btn");
        this._sharedContentButton = page.locator("#shared-contents-btn");
    }
    public async clickBsmLogo(): Promise<void> {
        return this._bsmLogo.click();
    }

    public async clickAddVersionButton(): Promise<void> {
        return this._addVersionButton.click();
    }

    public async clickSettingsButton(): Promise<void> {
        return this._settingsButton.click();
    }

    public async clickSharedContentButton(): Promise<void> {
        return this._sharedContentButton.click();
    }

}