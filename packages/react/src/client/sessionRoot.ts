import { createRootRouteWithContext, type NotFoundRouteComponent } from "@tanstack/react-router";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { type PermissionGuardOptions, permissionGuard } from "#adapters/permissionGuard.ts";
import type { AdminNavigation, ModuleParts, RegisteredAuth, RegisteredSession } from "#client/module.ts";

export interface SessionRouteContext {
	readonly adminPages: readonly AdminNavigation[];
	readonly auth: RegisteredAuth;
	readonly modules: readonly ModuleParts[];
	readonly navigate: (path: string) => void;
	// Naming the guard's type here carries its staticData augmentation into every app that reads the root route's type.
	readonly redirects: { readonly signedOut: PermissionGuardOptions["signedOut"] };
	readonly registry: AtomRegistry.AtomRegistry;
	readonly session: () => RegisteredSession | null | undefined;
}

function segments(path: string): readonly string[] {
	return path.replace(/\/$/u, "").split("/");
}

function isParameter(segment: string): boolean {
	return segment.startsWith("$") || /^\{-?\$[^}]*\}$/u.test(segment);
}

function matchesPath(declared: string, pathname: readonly string[]): boolean {
	const expected = segments(declared);
	return (
		expected.length === pathname.length
		&& expected.every((segment, index) => (isParameter(segment) ? pathname[index] !== "" : segment === pathname[index]))
	);
}

// Pages are matched against the location, not the matched route, so a literal or dispatcher route under a page's path still needs the page's permission; the bare admin index needs the first page's, as the admin document guard does.
function adminPagePermission(pages: readonly AdminNavigation[], pathname: string) {
	const actual = segments(pathname);
	const page =
		actual.join("/") === "/admin"
			? pages[0]
			: (pages.find(({ route }) => matchesPath(route.path, actual))
				?? pages.find(({ route }) => route.detail !== undefined && matchesPath(route.detail, actual)));
	return page === undefined ? [] : [{ staticData: { permission: page.route.permission } }];
}

export interface SessionRootOptions {
	readonly hidden?: boolean | undefined;
	readonly notFound?: NotFoundRouteComponent | undefined;
}

export function sessionRoot({ hidden = false, notFound }: SessionRootOptions = {}) {
	return createRootRouteWithContext<SessionRouteContext>()<unknown>({
		beforeLoad: ({ context, location, matches }) =>
			permissionGuard({ hidden, session: context.session, signedOut: context.redirects.signedOut })({
				location,
				matches: [...matches, ...adminPagePermission(context.adminPages, location.pathname)],
			}),
		...(notFound === undefined ? {} : { notFoundComponent: notFound }),
	});
}
