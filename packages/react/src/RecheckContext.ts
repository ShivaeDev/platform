import { createContext } from "react";

export const RecheckContext = createContext<() => void>((): void => undefined);
