import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { createMemoryHistory } from "@tanstack/react-router";
import { Effect, Predicate } from "effect";
import { act } from "react";
import { isClientIdle } from "@shivaedev/contract/clientActivity.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { type ScreenDriver, screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { App } from "#client/App.tsx";
import { makeFoundationClient } from "#client/admin/foundation.ts";
import { foundationRegistration } from "#client/admin/foundationRegistration.tsx";
import { makeAuth } from "#client/auth.ts";
import { connectModules } from "#client/Module.ts";
import { startHost } from "#test-support/host.ts";
import { postgres } from "#test-support/postgres.ts";
import { acquireScreen, type ScreenSurface, screenView } from "#test-support/screenState.ts";
import { mintUser } from "#test-support/sessionPrecondition.ts";

const warnings = expectNoReactWarnings();

interface Engine extends ScreenSurface {
	driver?: ScreenDriver;
	readonly host: Effect.Success<ReturnType<typeof startHost>>;
	role: string;
}

export const adminSessions = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create(): Generator<ReturnType<typeof startHost>, Engine, never> {
		return { host: yield* startHost(), role: "admin", view: undefined };
	},
	inspect: (engine) => ({ text: engine.view?.container.textContent }),
	layer: postgres,
	name: "admin sessions page",
	stages: ["viewer", "screen"],
	verbs: (engine, story) => {
		function driver() {
			if (engine.driver === undefined) {
				throw new Error("The admin sessions page is not open");
			}
			return engine.driver;
		}
		return {
			heading: () => Effect.sync(() => screenView(engine).container.querySelector("h1")?.textContent ?? "no heading"),
			revokesSession: (email: string) =>
				Effect.gen(function* () {
					story.tell(`alice revokes the session for ${email} and confirms`);
					yield* driver().click({ name: `Revoke session for ${email}`, role: "button" });
					yield* driver().click({ name: "Confirm revoke", role: "button" });
					yield* driver().settle();
				}),
			sessions: () =>
				Effect.sync(() =>
					[...screenView(engine).container.querySelectorAll('ul[aria-label="Sessions"] li')]
						.map((row) => {
							const email = row.querySelectorAll("p")[1]?.textContent ?? "no email";
							return row.textContent.includes("Your current session") ? `${email} (current session)` : email;
						})
						.sort((left, right) => left.localeCompare(right)),
				),
		};
	},
});

export const withoutSessionsPermission = adminSessions.trait("viewer", "alice has no sessions permission", (engine) => {
	engine.role = "user";
});

export const adminSessionsOpen = adminSessions.trait(
	"screen",
	"alice and bob are signed in and alice opens the Sessions page on the real app host",
	function* (engine) {
		const alice = yield* mintUser(engine.host, "alice", engine.role);
		yield* mintUser(engine.host, "bob");
		const headers = { cookie: alice.headers.get("cookie") ?? "", origin: engine.host.origin };
		const client = makeFoundationClient(`${engine.host.baseUrl}/rpc`, { headers, live: false, webSocketConstructor: layerWebSocketConstructorWS });
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
		const history = createMemoryHistory({ initialEntries: ["/admin/sessions"] });
		const view = yield* acquireScreen(
			engine,
			engine.role === "admin" ? undefined : { onCaughtError: warnings.expectCaughtError((error) => Predicate.isTagged(error, "Forbidden")) },
		);
		engine.driver = screenDriver({
			act,
			pending: () =>
				!isClientIdle(Effect.runSync(client.activity.current)) || authRequests > 0 || view.container.querySelector('[role="status"]') !== null,
			root: view.container,
			tell: () => undefined,
		});
		yield* Effect.promise(() => view.render(<App auth={auth} connect={() => connectModules([foundationRegistration(client)])} history={history} />));
		yield* engine.driver.settle();
	},
);
