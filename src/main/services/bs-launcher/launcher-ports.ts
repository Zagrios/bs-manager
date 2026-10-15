import path from "node:path";
import { ChildProcess, SpawnOptions } from "node:child_process";
import log from "electron-log";
import { pathExists } from "fs-extra";
import { BS_EXECUTABLE } from "main/constants";
import { BsmShellLog, bsmSpawn } from "main/helpers/os.helpers";
import { BSLocalVersionService } from "../bs-local-version.service";
import { StaticConfigurationService } from "../static-configuration.service";
import { LaunchContext, LaunchPlan, withLaunchToken } from "./launch-plan";
import { ProtonConfig } from "./game-runtime";
import {
    defaultOwnedProcessSessionPorts,
    launchOwnedProcess,
    OwnedProcessIdentity,
    OwnedProcessLaunch,
    OwnedProcessSession,
    OwnedProcessSessionPorts,
} from "./owned-process-session";

export type GameLauncherPorts = {
    session: OwnedProcessSessionPorts;
    env: NodeJS.ProcessEnv;
    localVersions: Pick<BSLocalVersionService, "getInstalledVersionPath">;
    pathExists(filePath: string): Promise<boolean>;
    spawnLaunchPlan(plan: LaunchPlan, cwd: string): ChildProcess;
    isCloseOnLaunchEnabled(): boolean;
};

export function defaultGameLauncherPorts(): GameLauncherPorts {
    const staticConfig = StaticConfigurationService.getInstance();
    return {
        session: defaultOwnedProcessSessionPorts(),
        env: process.env,
        localVersions: BSLocalVersionService.getInstance(),
        pathExists: filePath => pathExists(filePath),
        spawnLaunchPlan,
        isCloseOnLaunchEnabled: () => !!staticConfig.get("close-bs-manager-on-launch"),
    };
}

export function spawnLaunchPlan(plan: LaunchPlan, cwd: string): ChildProcess {
    const spawnOptions: SpawnOptions = {
        detached: true,
        cwd,
        env: plan.env,
        stdio: "ignore",
    };

    if (plan.args.includes("--verbose")){
        spawnOptions.windowsVerbatimArguments = true;
    }

    spawnOptions.shell = true; // For windows to spawn properly
    return bsmSpawn(plan.cmdlet, {
        args: plan.args, options: spawnOptions, log: BsmShellLog.Command,
        flatpak: { host: !!plan.hostEnvKeys, env: plan.hostEnvKeys },
    });
}

export function launchContext(ports: GameLauncherPorts, getProtonConfig?: () => Promise<ProtonConfig>): LaunchContext {
    return {
        platform: ports.session.platform,
        flatpak: ports.session.flatpak,
        baseEnv: ports.env,
        getProtonConfig,
    };
}

export function closeOnLaunch(ports: GameLauncherPorts): (owned: OwnedProcessIdentity) => void {
    return owned => {
        if (ports.isCloseOnLaunchEnabled()) {
            log.info(`Safely owned Beat Saber process ${owned.pid} started; closing BSManager`);
            ports.session.lifecycle.quit();
        }
    };
}

export function launchGame(
    ports: GameLauncherPorts,
    plan: LaunchPlan,
    gameFolder: string,
    onAcquisitionFailure?: OwnedProcessLaunch["onAcquisitionFailure"]
): Promise<OwnedProcessSession> {
    return launchOwnedProcess({
        executablePath: path.join(gameFolder, BS_EXECUTABLE),
        spawn: ({ launchToken }) => ({
            process: ports.spawnLaunchPlan(withLaunchToken(plan, launchToken), gameFolder),
        }),
        onStarted: closeOnLaunch(ports),
        onAcquisitionFailure,
    }, ports.session);
}
