import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { createMemoryHistory } from "@tanstack/react-router";
import { Effect, Predicate } from "effect";
import { clientActivity, isClientIdle } from "@shivaedev/contract/clientActivity.ts";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { App } from "#client/App.tsx";
import { makeFoundationClient } from "#client/admin/foundation.ts";
import { foundationRegistration } from "#client/admin/foundationRegistration.tsx";
import { makeAuth } from "#client/auth.ts";
import { clientModules } from "#client/modules.ts";
import { makeAdminClient } from "#modules/notes/client/admin/make.ts";
import { adminRegistration } from "#modules/notes/client/admin/registration.tsx";
import { acquireScreen } from "#test-support/screenState.ts";
import type { AdminScreen } from "./screens.tsx";

const warnings = expectNoReactWarnings();

export const openScreen = Effect.fn("AdminScreen.openScreen")(function* (engine: AdminScreen, path: string, role: string) {
	const headers = { cookie: engine.accounts.get("alice")?.headers.get("cookie") ?? "", origin: engine.host.origin };
	const options = { headers, live: false, webSocketConstructor: layerWebSocketConstructorWS };
	const client = makeFoundationClient(`${engine.host.baseUrl}/rpc`, options);
	const notes = makeAdminClient(`${engine.host.baseUrl}/rpc`, options);
	engine.activity = client.activity;
	let authRequests = 0;
	const auth = makeAuth({
		baseUrl: engine.host.baseUrl,
		fetchOptions: {
			customFetchImpl: async (input, init) => {
				authRequests += 1;
				try {
					return await fetch(input, { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), ...headers } });
				} finally {
					authRequests -= 1;
				}
			},
		},
	});
	const view = yield* acquireScreen(
		engine,
		role === "user" ? { onCaughtError: warnings.expectCaughtError((error) => Predicate.isTagged(error, "Forbidden")) } : undefined,
	);
	engine.pending = () =>
		authRequests > 0 || !isClientIdle(Effect.runSync(clientActivity(notes).current)) || view.container.querySelector('[role="status"]') !== null;
	const history = createMemoryHistory({ initialEntries: [path] });
	yield* Effect.promise(() =>
		view.render(
			<App
				auth={auth}
				connect={(session) => clientModules(session, [foundationRegistration(client), Effect.succeed(adminRegistration(notes))])}
				history={history}
			/>,
		),
	);
});
