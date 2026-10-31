import { Effect } from "effect";
import { act } from "react";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { type Rendered, render } from "@shivaedev/test-story/client/react.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { postgresConfigured, postgresLayer } from "./jobsEngine.ts";
import { SessionsScreenApp } from "./SessionsScreenApp.tsx";
import { sessionsHost } from "./sessionsHost.ts";

type Engine = Effect.Success<ReturnType<typeof sessionsHost>> & { screen: Rendered | undefined };

function screenOf(engine: Engine) {
	if (engine.screen === undefined) {
		throw new Error("The sessions view is not open");
	}
	return engine.screen.container;
}

function driverFor(engine: Engine, tell: (line: string) => void) {
	return screenDriver({ act, pending: engine.activity, root: () => screenOf(engine), tell });
}

export const sessionsScreen = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create(): Generator<ReturnType<typeof sessionsHost>, Engine, never> {
		return { ...(yield* sessionsHost()), screen: undefined };
	},
	inspect: (engine) => ({ text: engine.screen?.container.textContent }),
	layer: postgresLayer,
	name: "admin sessions screen",
	runIf: postgresConfigured,
	stages: ["viewer", "sessions", "screen"],
	verbs: (engine, story) => {
		const driver = driverFor(engine, story.tell);
		return {
			alerts: () => Effect.sync(() => [...screenOf(engine).querySelectorAll('[role="alert"]')].map(({ textContent }) => textContent)),
			cancelRevoke: () => driver.click({ name: "Cancel", role: "button" }),
			confirmation: () =>
				Effect.sync(() => screenOf(engine).querySelector('[aria-label="Confirm session revocation"]')?.textContent ?? "no confirmation"),
			confirmRevoke: () => Effect.andThen(driver.click({ name: "Confirm revoke", role: "button" }), driver.settle()),
			content: () => Effect.sync(() => screenOf(engine).textContent),
			nextSessions: () => Effect.andThen(driver.click({ name: "Next sessions", role: "button" }), driver.settle()),
			previousSessions: () => Effect.andThen(driver.click({ name: "Previous sessions", role: "button" }), driver.settle()),
			refreshSessions: () => Effect.andThen(driver.click({ name: "Refresh sessions", role: "button" }), driver.settle()),
			requestRevoke: (name: string) => driver.click({ name: `Revoke session for ${name}@app.test`, role: "button" }),
			revokeElsewhere: engine.revokeElsewhere,
			shownEmails: () => Effect.sync(() => [...screenOf(engine).querySelectorAll("li")].map((row) => row.querySelectorAll("p")[1]?.textContent)),
			shownSessions: () =>
				Effect.sync(() =>
					[...screenOf(engine).querySelectorAll("li")].map((row) => ({
						current: row.textContent?.includes("Your current session") ?? false,
						email: row.querySelectorAll("p")[1]?.textContent,
						name: row.querySelector("p")?.textContent,
						times: [...row.querySelectorAll("time")].map((time) => ({ text: time.textContent, value: time.dateTime })),
					})),
				),
		};
	},
});

export const unprivilegedViewer = sessionsScreen.trait("viewer", "bob has no sessions permission", (engine) => engine.as("bob"));

export const sessionsViewOpen = sessionsScreen.trait("screen", "the Sessions view opens against the admin HTTP host", function* (engine) {
	Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
	engine.screen = yield* Effect.acquireRelease(
		Effect.promise(() => render(<SessionsScreenApp engine={engine} />)),
		(view) => Effect.promise(view.unmount),
	);
	yield* driverFor(engine, () => undefined).settle();
});

export const anotherPageOfSessions = sessionsScreen.trait(
	"sessions",
	"nineteen more users have newer sessions so bob is on the second page",
	(engine) => engine.addSessions(Array.from({ length: 19 }, (_, index) => `guest-${index}`)),
);
