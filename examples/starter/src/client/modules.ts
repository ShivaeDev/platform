import type { SessionRouter } from "@shivaedev/react/client/sessionRouter.ts";
import { clientApp } from "@shivaedev/react/client/app.ts";
import type { AppSession, AuthActions } from "#client/adapters/auth.ts";
import { modules } from "#generated/client/modules.ts";

export const clientModules = clientApp(modules);

declare module "@shivaedev/react/client/module.ts" {
	interface Register {
		readonly auth: AuthActions;
		readonly session: AppSession;
	}
}

declare module "@tanstack/react-router" {
	interface Register {
		router: SessionRouter<typeof clientModules>;
	}
}
