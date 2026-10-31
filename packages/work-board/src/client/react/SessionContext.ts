import { createContext } from "react";
import type { BrowserClient } from "#adapters/browserClient.ts";

export const SessionContext = createContext<BrowserClient | undefined>(undefined);
