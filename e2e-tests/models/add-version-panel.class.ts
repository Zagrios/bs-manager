import { Page, Locator } from "playwright";
import { MainWindow } from "./main-window.class";

export class AddVersionPanel extends MainWindow {

    private readonly _yearsTabBar: Locator;
    private readonly _downloadVersionButton: Locator;

    constructor(page: Page) {
        super(page);

        this._yearsTabBar = page.locator("#version-years-tab-bar");
        this._downloadVersionButton = page.locator("#download-version-btn");
    }

    selectYear(year: string): Promise<void>{
        return this._yearsTabBar.getByText(year).click();
    }

    clickVersion(manifest: string): Promise<void>{
        return this._page.locator(`#version-item-${manifest}`).click();
    }

    get downloadVersionButton(): Locator { return this._downloadVersionButton; }

}