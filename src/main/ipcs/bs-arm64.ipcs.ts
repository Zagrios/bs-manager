import { from } from "rxjs";
import { BsArm64Service } from "main/services/bs-arm64.service";
import { IpcService } from "../services/ipc.service";

const ipc = IpcService.getInstance();

ipc.on("bs-arm64.get-status", (version, reply) => {
    reply(from(BsArm64Service.getInstance().getStatus(version)));
});

ipc.on("bs-arm64.get-native-versions", (_, reply) => {
    reply(from(BsArm64Service.getInstance().getNativeVersions()));
});

ipc.on("bs-arm64.install", (version, reply) => {
    reply(BsArm64Service.getInstance().install(version));
});

ipc.on("bs-arm64.uninstall", (version, reply) => {
    reply(BsArm64Service.getInstance().uninstall(version));
});
