import { useConstant } from "./use-constant.hook";
import { Service } from "shared/models/service.interface";

export function useService<T>(s: Service<T>): T {
    const service = useConstant(() => s.getInstance());
    return service;
}
