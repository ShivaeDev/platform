import { createRoute, linkOptions } from "@tanstack/react-router";
import { expectTypeOf } from "vitest";
import { type AdminNavigation, clientModule } from "@shivaedev/react/client/module.ts";
import type { AppSession, AuthActions } from "#client/adapters/auth.ts";

export const signIn = linkOptions({ search: { returnTo: "/notes/1?tab=history" }, to: "/sign-in" });
// @ts-expect-error Return targets are strings.
export const invalidSearch = linkOptions({ search: { returnTo: 123 }, to: "/sign-in" });
// @ts-expect-error Only application route paths are valid.
export const invalidPath = linkOptions({ to: "/missing-route" });

clientModule({}, () => ({
	routes: (root) => [
		createRoute({
			beforeLoad: ({ context }) => {
				expectTypeOf(context.adminPages).toEqualTypeOf<readonly AdminNavigation[]>();
				expectTypeOf(context.auth).toEqualTypeOf<AuthActions>();
				expectTypeOf(context.session()).toEqualTypeOf<AppSession | null | undefined>();
			},
			getParentRoute: () => root,
			path: "/typed-root",
		}),
	],
}));
