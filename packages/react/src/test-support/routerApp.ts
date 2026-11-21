import { createMemoryHistory, createRootRouteWithContext, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { Effect, Option, Schema } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { queryRoute } from "#client/adapters/queryRoute.ts";
import type { QueryRouteRedirect, QueryRouteRedirects } from "#queryRouteFailure.ts";
import { signInRedirect } from "#signInRedirect.ts";
import { noteFailures, noteQuery } from "#test/noteQuery.ts";
import type { routerClient } from "#test/routerClient.ts";
import {
	RouterFailure,
	RouterMemberSignIn,
	RouterNote,
	RouterNotFound,
	RouterPending,
	RouterRefused,
	RouterShell,
	RouterSignIn,
	SharedNotFound,
} from "#test/routerScreens.tsx";

export const root = createRootRouteWithContext<{
	readonly client: ReturnType<typeof routerClient>;
	readonly viewerPage: number;
	readonly frames: string[];
	readonly redirects: QueryRouteRedirects;
	readonly registry: AtomRegistry.AtomRegistry;
}>()({ beforeLoad: ({ context }) => ({ viewer: { page: context.viewerPage } }), component: RouterShell, notFoundComponent: SharedNotFound });

export const RouterSearch = Schema.Struct({
	page: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)).pipe(
		Schema.catchDecoding(() => Effect.succeed(Option.some(1))),
		Schema.withDecodingDefaultKey(Effect.succeed(1)),
	),
});

function noteRoute() {
	return createRoute({
		component: RouterNote,
		errorComponent: RouterFailure,
		getParentRoute: () => root,
		...noteQuery,
		path: "/notes/$id",
		validateSearch: Schema.toStandardSchemaV1(RouterSearch),
	});
}

const customNotFoundRoute = createRoute({
	getParentRoute: () => root,
	...queryRoute(
		({ context, params }: { context: typeof root.types.allContext; params: { id: string }; search: object }) =>
			context.client.api.get.query({ id: params.id, page: 1 }),
		{ failures: noteFailures },
	),
	notFoundComponent: RouterNotFound,
	path: "/custom-notes/$id",
});

const signIn = createRoute({
	component: RouterSignIn,
	getParentRoute: () => root,
	path: "/sign-in",
	validateSearch: Schema.toStandardSchemaV1(Schema.Struct({ returnTo: Schema.optionalKey(Schema.String) })),
});
const memberSignIn = createRoute({ component: RouterMemberSignIn, getParentRoute: () => root, path: "/member-sign-in" });
const refused = createRoute({ component: RouterRefused, getParentRoute: () => root, path: "/no-access" });
const redirected = createRoute({
	getParentRoute: () => root,
	path: "/redirected/$id",
	validateSearch: Schema.toStandardSchemaV1(RouterSearch),
	...queryRoute(
		({ context, params, search }: { context: typeof root.types.allContext; params: { id: string }; search: typeof RouterSearch.Type }) =>
			context.client.api.get.query({ ...params, page: search.page }),
		{ failures: noteFailures },
	),
});
const members = createRoute({
	getParentRoute: () => root,
	path: "/members/$id",
	...queryRoute(
		({ context, params }: { context: typeof root.types.allContext; params: { id: string }; search: object }) =>
			context.client.api.get.query({ ...params, page: 1 }),
		{
			failures: noteFailures,
			redirects: { signedOut: (): QueryRouteRedirect => redirect<ReturnType<typeof routerApp>, "/member-sign-in">({ to: memberSignIn.fullPath }) },
		},
	),
});

export function routerApp(
	registry: AtomRegistry.AtomRegistry,
	client: ReturnType<typeof routerClient>,
	initial = "/notes/first",
	page = 1,
	refusals = true,
) {
	return createRouter({
		context: {
			client,
			frames: client.frames,
			redirects: {
				signedOut: signInRedirect("/sign-in"),
				...(refusals ? { refused: (): QueryRouteRedirect => redirect<ReturnType<typeof routerApp>, "/no-access">({ to: refused.fullPath }) } : {}),
			},
			registry,
			viewerPage: page,
		},
		defaultPendingComponent: RouterPending,
		defaultPendingMs: Number.POSITIVE_INFINITY,
		history: createMemoryHistory({ initialEntries: [initial] }),
		routeTree: root.addChildren([noteRoute(), customNotFoundRoute, signIn, memberSignIn, refused, redirected, members]),
	});
}
