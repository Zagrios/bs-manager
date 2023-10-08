import {Page} from 'playwright';
import { test, expect } from '@playwright/test';
import { getRecordingPath, startApp } from './helpers/electron.helpers';
import { pause } from 'shared/helpers/promise.helpers';
import { MainWindow } from './models/main-window.class';
import { AddVersionPanel } from './models/add-version-panel.class';


let appWindow: Page;
let mainWindow: MainWindow;
let addVersionPanel: AddVersionPanel;

test.beforeAll(async () => {
    const startAppResponse = await startApp();
    appWindow = startAppResponse.appWindow;
    mainWindow = new MainWindow(appWindow);
    addVersionPanel = new AddVersionPanel(appWindow);
});

test.beforeEach(async () => {
    await pause(1000);
    await mainWindow.clickAddVersionButton();
});

test.afterEach(async () => {
    await pause(1000);
});

test('should be able to select then unselect a bs version', async () => {
    const versionManifest = "8948172000430595334";
    await addVersionPanel.selectYear("2021");
    await pause(1000);

    await addVersionPanel.clickVersion(versionManifest); // select version 0.12.2
    await pause(1000);

    expect(await addVersionPanel.downloadVersionButton.isVisible()).toBeTruthy();

    await addVersionPanel.clickVersion(versionManifest);  // deselect version 0.12.2
    await pause(3000);

    expect(await addVersionPanel.downloadVersionButton.isVisible()).toBeFalsy();

    // sadly we can't test if the download works or not :( (Steam ids, dot-net, etc)
});

test('should be able to download a map then delete it', async () => {
    // TODO: implement this test
});

test.afterAll(async () => {
    await pause(3000);
    await appWindow.screenshot({path: getRecordingPath("final-screen.png")});
    await appWindow.close();
});