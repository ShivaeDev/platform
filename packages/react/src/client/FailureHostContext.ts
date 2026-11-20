import { createContext } from "react";
import type { UnexpectedFailure } from "#client/unexpectedFailure.ts";

export const FailureHostContext = createContext<((failure: UnexpectedFailure) => void) | undefined>(undefined);
