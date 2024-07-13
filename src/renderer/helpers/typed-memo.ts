import { memo } from "react";

export const typedMemo: <T, P>(c: T, propsAreEqual?: (prevProps: Readonly<P>, nextProps: Readonly<P>) => boolean) => T = memo;
