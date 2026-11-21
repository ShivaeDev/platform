import { createContext, type ReactNode } from "react";
import type { UnexpectedFailure } from "#client/unexpectedFailure.ts";

export interface FailureHost {
	readonly report: (failure: UnexpectedFailure, retry?: () => void) => (() => void) | undefined;
	readonly word: (failure: UnexpectedFailure) => ReactNode;
}

export const FailureHostContext = createContext<FailureHost | undefined>(undefined);
