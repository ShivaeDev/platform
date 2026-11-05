import { createMemoryHistory } from "@tanstack/react-router";
import { Effect, Queue } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Screen } from "#test/Screen.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { App } from "./App.tsx";
import { makeAuth } from "./auth.ts";
import { openHost } from "./openHost.ts";

export const reconnectSessions = storyKit({
	*create() {
		const host = yield* openHost;
		const auth = yield* makeAuth;
		const screen = new Screen(() => undefined);
		const errors: string[] = [];
		const history = createMemoryHistory({ initialEntries: ["/"] });
		const view = yield* screen.open(<App auth={auth} errors={errors} history={history} url={host.url} />);
		yield* settleScreen(view.container, () => view.container.querySelector('[data-live="live"][data-pending="false"]') === null, screen.tell);
		yield* Queue.take(host.handshakes);
		yield* Queue.take(auth.checked);
		yield* Queue.take(auth.started);
		return { auth, errors, history, host, screen, view };
	},
	inspect: ({ auth, host, view }) => ({ auth: auth.state, host: host.state, html: view.container.innerHTML }),
	name: "session recovery over a dropped WebSocket",
	stages: ["screen"],
	verbs: ({ auth, errors, history, host, screen, view }, story) => {
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
			nextCheck: () => screen.act("the session check finishes", () => Effect.runPromise(Queue.take(auth.checked))),
			nextHandshake: () => screen.act("the next socket handshake reaches the server", () => Effect.runPromise(Queue.take(host.handshakes))),
			nextSessionRequest: () => screen.act("the next session request starts", () => Effect.runPromise(Queue.take(auth.started))),
			queryErrors: () => Effect.sync(() => [...errors]),
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
				settleScreen(view.container, () => view.container.querySelector('[data-live="live"][data-pending="false"]') === null, story.tell),
		};
	},
});
