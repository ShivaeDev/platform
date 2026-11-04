import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { createMemoryHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import type { RootOptions } from "react-dom/client";
import { clientActivity, isClientIdle } from "@shivaedev/contract/clientActivity.ts";
import { seedCookies } from "@shivaedev/test-story/server/adapters/seedCookies.ts";
import { browserReads } from "@shivaedev/test-story/server/browserReads.ts";
import type { AppAccess } from "#AppAccess.ts";
import { foundation } from "#admin/foundation.ts";
import { App } from "#client/App.tsx";
import { makeFoundationClient } from "#client/admin/foundation.ts";
import { foundationRegistration } from "#client/admin/foundationRegistration.tsx";
import { clientModules } from "#client/modules.ts";
import { StatisticsPage } from "#modules/notes/admin/pages.ts";
import { makeAdminClient } from "#modules/notes/client/admin/make.ts";
import { makeNotesClient } from "#modules/notes/client/make.ts";
import { notesRegistration } from "#modules/notes/client/registration.tsx";
import { Notes } from "#modules/notes/notes.ts";
import { createCookieHost } from "./createCookieHost.ts";
import type { RunningHost } from "./host.ts";
import { acquireScreen, type ScreenSurface } from "./screenState.ts";
import { mintUser } from "./sessionPrecondition.ts";

export const appScreen = Effect.fn("AppStory.appScreen")(function* (options: {
	readonly account: { readonly name: string; readonly role?: typeof AppAccess.Role.Type };
	readonly route: string;
	readonly host?: RunningHost;
	readonly renderOptions?: RootOptions;
}) {
	const host = yield* createCookieHost(options.host);
	const account = yield* mintUser(host, options.account.name, options.account.role);
	yield* seedCookies(account.cookies);
	const url = `${host.baseUrl}/rpc`;
	const observed = yield* browserReads({
		contracts: [Notes, StatisticsPage.contract, foundation.UsersPage.contract, foundation.JobsPage.contract, foundation.SessionsPage.contract],
		headers: { cookie: account.headers.get("cookie") ?? "", origin: host.origin },
		url,
		webSocketConstructor: layerWebSocketConstructorWS,
	});
	const clientOptions = { protocol: observed.protocol, url };
	const client = makeNotesClient(url, clientOptions);
	const admin = makeAdminClient(url, { ...clientOptions, live: false });
	const foundationClient = makeFoundationClient(url, { ...clientOptions, live: false });
	const surface: ScreenSurface = { activity: clientActivity(client), transport: host.fetch.pending, view: undefined };
	const view = yield* acquireScreen(surface, options.renderOptions);
	const history = createMemoryHistory({ initialEntries: [options.route] });
	function pending() {
		return (
			view.registry.get(host.auth.session.atom).waiting
			|| view.registry.get(host.auth.actions.submit).waiting
			|| view.registry.get(host.auth.actions.signOut).waiting
			|| !isClientIdle(Effect.runSync(clientActivity(admin).current))
			|| !isClientIdle(Effect.runSync(foundationClient.activity.current))
			|| view.container.querySelector('[role="status"]') !== null
		);
	}
	yield* Effect.promise(() =>
		view.render(
			<App
				auth={host.auth}
				connect={(session) => clientModules(session, [foundationRegistration(foundationClient), notesRegistration(client, admin)])}
				history={history}
			/>,
		),
	);
	return { ...host, ...surface, account, client, foundationClient, history, observed, pending, view };
});
