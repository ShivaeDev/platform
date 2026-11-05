import { DateTime, Effect, Predicate } from "effect";
import { act } from "react";
import { activityScreenSignal } from "@shivaedev/contract/clientActivity.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { type ScreenDriver, screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { AppAccess } from "#AppAccess.ts";
import { appScreen } from "#test-support/appScreen.tsx";
import { startHost } from "#test-support/host.ts";
import { configured, postgres } from "#test-support/postgres.ts";
import { type ScreenSurface, screenView } from "#test-support/screenState.ts";
import { mintUser } from "#test-support/sessionPrecondition.ts";

const warnings = expectNoReactWarnings();

interface Engine extends ScreenSurface {
	driver?: ScreenDriver;
	readonly host: Effect.Success<ReturnType<typeof startHost>>;
	role: typeof AppAccess.Role.Type;
}

export const adminSessions = storyKit({
	clock: Effect.runSync(DateTime.now),
	around: withIsolatedDatabase,
	*create(): Generator<ReturnType<typeof startHost>, Engine, never> {
		return { host: yield* startHost(), role: "admin", view: undefined };
	},
	inspect: (engine) => ({ text: engine.view?.container.textContent }),
	layer: postgres,
	name: "admin sessions page",
	runIf: configured,
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
		yield* mintUser(engine.host, "bob");
		const screen = yield* appScreen({
			account: { name: "alice", role: engine.role },
			host: engine.host,
			renderOptions: engine.role === "admin" ? {} : { onCaughtError: warnings.expectCaughtError((error) => Predicate.isTagged(error, "Forbidden")) },
			route: "/admin/sessions",
		});
		Object.assign(engine, screen);
		engine.driver = screenDriver({
			act,
			activity: activityScreenSignal(screen.foundationClient.activity),
			pending: screen.pending,
			root: screen.view.container,
			tell: () => undefined,
			transport: screen.fetch.pending,
		});
		yield* engine.driver.settle();
	},
);
