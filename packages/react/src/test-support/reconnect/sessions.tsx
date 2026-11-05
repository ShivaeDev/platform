import { createMemoryHistory } from "@tanstack/react-router";
import { type Duration, Effect, Queue } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { passes, untilTimer, watchedClock } from "@shivaedev/test-story/server/watchedClock.ts";
import { Screen } from "#test/Screen.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { storyRuntime } from "#test/storyRuntime.ts";
import { App } from "./App.tsx";
import { makeAuth } from "./auth.ts";
import { openHost } from "./openHost.ts";
import { settleOnSignal } from "./settleOnSignal.ts";

export const reconnectSessions = storyKit({
	*create() {
		const clock = yield* watchedClock;
		const runtime = yield* storyRuntime;
		const run = Effect.runPromiseWith(yield* Effect.context());
		const host = yield* openHost;
		const auth = yield* makeAuth;
		const screen = new Screen(() => undefined);
		const errors: string[] = [];
		const history = createMemoryHistory({ initialEntries: ["/"] });
		const view = yield* screen.open(<App auth={auth} errors={errors} history={history} runtime={runtime} url={host.url} />);
		yield* settleScreen(view.container, () => view.container.querySelector('[data-live="live"][data-pending="false"]') === null, screen.tell);
		yield* Queue.take(host.handshakes);
		yield* Queue.take(auth.checked);
		yield* Queue.take(auth.started);
		return { auth, clock, errors, history, host, run, screen, view };
	},
	inspect: ({ auth, host, view }) => ({ auth: auth.state, host: host.state, html: view.container.innerHTML }),
	name: "session recovery over a dropped WebSocket",
	stages: ["screen"],
	verbs: ({ auth, clock, errors, history, host, run, screen, view }, story) => {
		screen.tell = story.tell;
		return {
			checkIntervals: () => Effect.sync(() => auth.state.checks.slice(2).map(({ at }, index) => at - (auth.state.checks[index + 1]?.at ?? at))),
			checks: () => Effect.sync(() => auth.state.checks.map(({ operation }) => operation)),
			dropSocket: () => screen.act("the server drops the socket", () => Effect.runPromise(host.drop())),
			failSessionChecks: () =>
				Effect.sync(() => {
					story.tell("Better Auth keeps alice's data but reports an unreachable session server");
					auth.state.reachable = false;
				}),
			holdSessionChecks: () =>
				Effect.sync(() => {
					story.tell("the session server holds its next response");
					auth.state.hold = true;
				}),
			nextCheck: () => settleOnSignal("the session check finishes", Queue.take(auth.checked), { clock, root: view.container, tell: story.tell }),
			nextSessionRequest: () => screen.act("the next session request starts", () => Effect.runPromise(Queue.take(auth.started))),
			queryErrors: () => Effect.sync(() => [...errors]),
			reconnectIntervalPasses: () =>
				settleOnSignal("the socket reconnect interval passes", Queue.take(host.handshakes), { clock, root: view.container, tell: story.tell }),
			refusedAccountRequests: () => Effect.sync(() => [...host.state.failures]),
			refuseReconnect: () =>
				Effect.sync(() => {
					story.tell("the next RPC subscription refuses alice's authentication");
					host.state.authorized = false;
				}),
			releaseSessionRead: () =>
				screen.act("the session refetch answers signed out", () => {
					for (const resolve of auth.pending.splice(0)) {
						resolve();
					}
				}),
			restoreSessionChecks: () =>
				Effect.sync(() => {
					story.tell("the session server returns");
					auth.state.reachable = true;
				}),
			resume: (event: "online" | "visibilitychange") => screen.act(`the browser emits ${event}`, () => window.dispatchEvent(new Event(event))),
			retryIntervalPasses: (interval: Duration.Input) =>
				screen.act(`${interval} pass before the next session check`, () =>
					run(untilTimer(interval).pipe(Effect.andThen(passes(interval, Queue.take(auth.checked))))),
				),
			serverReturns: () =>
				Effect.sync(() => {
					story.tell("the RPC server returns");
					host.state.reachable = true;
				}),
			serverUnavailable: () =>
				Effect.sync(() => {
					story.tell("the RPC server becomes unreachable");
					host.state.reachable = false;
				}),
			shown: () => Effect.sync(() => view.container.textContent),
			signedOutAnswer: () =>
				screen.act("the session server confirms signed out", () => {
					auth.state.signedIn = false;
					auth.state.reachable = true;
				}),
			signOut: () => screen.driver(view.container).click({ name: "Sign out", role: "button" }),
			signOutAnswers: () =>
				screen.act("sign-out succeeds and holds its session refetch", () => {
					auth.state.hold = true;
					auth.state.signedIn = false;
					host.state.authorized = false;
					auth.signOutResponse.resolve();
				}),
			signOutIntent: () => Effect.sync(() => (history.location.state.__platformSignOut ? "explicit sign-out" : "ordinary visit")),
			signOutRefused: () => screen.act("the auth server refuses sign-out", () => auth.signOutResponse.reject("Sign-out unavailable")),
			visitSignIn: () => screen.act("the route moves to sign-in before the refetch answers", () => history.push("/sign-in")),
			waitForLive: () =>
				screenDriver({
					act,
					clock,
					pending: () => view.container.querySelector('[data-live="live"][data-pending="false"]') === null,
					root: view.container,
					tell: story.tell,
				}).settle(),
		};
	},
});
