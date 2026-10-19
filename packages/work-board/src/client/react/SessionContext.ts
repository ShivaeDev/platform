import { createContext } from "react";
import type { BrowserClient } from "#browserClient.ts";

export const SessionContext = createContext<BrowserClient | undefined>(undefined);
