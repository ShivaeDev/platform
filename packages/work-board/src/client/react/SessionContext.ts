import { createContext } from "react";
import type { BrowserClient } from "#client/client.ts";

export const SessionContext = createContext<BrowserClient | undefined>(undefined);
