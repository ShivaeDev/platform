import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { createMemoryHistory } from "@tanstack/react-router";
import { Effect } from "effect";
import type { RootOptions } from "react-dom/client";
import { type ClientActivity, isClientIdle } from "@shivaedev/contract/clientActivity.ts";
import type { ClientOptions } from "@shivaedev/contract/clientOptions.ts";
import { seedCookies } from "@shivaedev/test-story/server/adapters/seedCookies.ts";
import { type BrowserReadsOptions, browserReads } from "@shivaedev/test-story/server/browserReads.ts";
import type { AppAccess } from "#AppAccess.ts";
import { foundation } from "#admin/foundation.ts";
import { App } from "#client/App.tsx";
import { makeFoundationClient } from "#client/admin/foundation.ts";
import { foundationRegistration } from "#client/admin/foundationRegistration.tsx";
import type { ClientRegistration } from "#client/Module.ts";
import { clientModules } from "#client/modules.ts";
import { createCookieHost } from "./createCookieHost.ts";
import type { RunningHost } from "./host.ts";
import { acquireScreen, type ScreenSurface } from "./screenState.ts";
import { mintUser } from "./sessionPrecondition.ts";

export const appScreen = Effect.fn("AppStory.appScreen")(function* (options: {
	readonly account: { readonly name: string; readonly role?: typeof AppAccess.Role.Type };
	readonly route: string;
	readonly host?: RunningHost;
	readonly renderOptions?: RootOptions;
	readonly modules?: {
		readonly contracts: BrowserReadsOptions["contracts"];
		readonly connect: (options: Pick<ClientOptions, "url" | "protocol">) => {
			readonly activity: ClientActivity;
			readonly pending: () => boolean;
			readonly registrations: readonly ClientRegistration[];
		};
	};
}) {
	const host = yield* createCookieHost(options.host);
	const account = yield* mintUser(host, options.account.name, options.account.role);
	yield* seedCookies(account.cookies);
	const url = `${host.baseUrl}/rpc`;
	const observed = yield* browserReads({
		contracts: [foundation.UsersPage.contract, foundation.JobsPage.contract, foundation.SessionsPage.contract, ...(options.modules?.contracts ?? [])],
		headers: { cookie: account.headers.get("cookie") ?? "", origin: host.origin },
		url,
		webSocketConstructor: layerWebSocketConstructor,
	});
	const clientOptions = { protocol: observed.protocol, url };
	const foundationClient = makeFoundationClient(url, { ...clientOptions, live: false });
	const modules = options.modules?.connect(clientOptions);
	const surface: ScreenSurface = { activity: modules?.activity ?? foundationClient.activity, transport: host.fetch.pending, view: undefined };
	const view = yield* acquireScreen(surface, options.renderOptions);
	const history = createMemoryHistory({ initialEntries: [options.route] });
	function pending() {
		return (
			view.registry.get(host.auth.session.atom).waiting
			|| view.registry.get(host.auth.actions.submit).waiting
			|| view.registry.get(host.auth.actions.signOut).waiting
			|| (modules?.pending() ?? false)
			|| !isClientIdle(Effect.runSync(foundationClient.activity.current))
			|| view.container.querySelector('[role="status"]') !== null
		);
	}
	yield* Effect.promise(() =>
		view.render(
			<App
				auth={host.auth}
				connect={(session) => clientModules(session, [foundationRegistration(foundationClient), ...(modules?.registrations ?? [])])}
				history={history}
			/>,
		),
	);
	return { ...host, ...surface, account, foundationClient, history, observed, pending, view };
});
