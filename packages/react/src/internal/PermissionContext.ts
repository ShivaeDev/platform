import { createContext, type ReactNode } from "react";
import type { PermissionSession } from "@shivaedev/identity/PermissionSession.ts";

export const PermissionContext = createContext<{ readonly fallback: ReactNode; readonly session: PermissionSession | null | undefined } | undefined>(
	undefined,
);
