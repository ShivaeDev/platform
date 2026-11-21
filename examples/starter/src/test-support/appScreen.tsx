import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { createMemoryHistory } from "@tanstack/react-router";
import { Deferred, Effect } from "effect";
import { act } from "react";
import type { RootOptions } from "react-dom/client";
import { type ClientActivity, clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { type AppConnection, clientApp } from "@shivaedev/react/client/app.ts";
import { mintUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { seedCookies } from "@shivaedev/test-story/server/adapters/seedCookies.ts";
import { browserReads } from "@shivaedev/test-story/server/browserReads.ts";
import type { AppAccess } from "#AppAccess.ts";
import { App } from "#client/App.tsx";
import { modules } from "#generated/client/modules.ts";
import { AppAuth } from "#server/AppAuth.ts";
import { createCookieHost } from "#test-support/createCookieHost.ts";
import type { RunningHost } from "#test-support/host.ts";
import { recordedApp } from "#test-support/recordedApp.ts";
import { acquireScreen, type ScreenSurface } from "#test-support/screenState.ts";

export const appScreen = Effect.fn("AppStory.appScreen")(function* (options: {
	readonly account: { readonly name: string; readonly role?: typeof AppAccess.Role.Type };
	readonly route: string;
	readonly host?: RunningHost;
	readonly renderOptions?: RootOptions;
}) {
	const host = yield* createCookieHost(options.host);
	const account = yield* mintUser(AppAuth, host, options.account.name, { role: options.account.role });
	yield* seedCookies(account.cookies);
	const url = `${host.baseUrl}/rpc`;
	const observed = yield* browserReads({
		contracts: modules.flatMap((module) => Object.values(module.contracts)),
		headers: { cookie: account.headers.get("cookie") ?? "", origin: host.origin },
		url,
		webSocketConstructor: layerWebSocketConstructor,
	});
	const activities: ClientActivity[] = [];
	const surface: ScreenSurface = { activities, transport: host.fetch.pending, view: undefined };
	const connected = Deferred.makeUnsafe<AppConnection>();
	const app = recordedApp(clientApp(modules, { protocol: observed.protocol, url }), (made) => {
		activities.splice(0, activities.length, clientActivity(made));
		Deferred.doneUnsafe(connected, Effect.succeed(made));
	});
	const view = yield* acquireScreen(surface, options.renderOptions);
	const history = createMemoryHistory({ initialEntries: [options.route] });
	function pending() {
		return (
			host.sessionPending(view.registry)
			|| view.registry.get(host.auth.actions.submit).waiting
			|| view.registry.get(host.auth.actions.signOut).waiting
			|| view.container.querySelector('[role="status"]') !== null
		);
	}
	yield* Effect.promise(() => view.render(<App app={app} auth={host.auth} history={history} />));
	const connection = yield* Effect.promise(() => act(() => Effect.runPromise(Deferred.await(connected))));
	return { ...host, ...surface, account, connection, history, observed, pending, view };
});
