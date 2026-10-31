import { RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { TestClock } from "effect/testing";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Screen } from "#test/Screen.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { deniedLiveApp } from "./app.tsx";
import { deniedLiveClient } from "./client.ts";

export const deniedLive = storyKit({
	clock: "test",
	*create() {
		const client = yield* deniedLiveClient;
		const run = Effect.runPromiseWith(yield* Effect.context());
		const screen = new Screen(() => undefined);
		const view = yield* screen.open();
		const router = deniedLiveApp(view.registry, client);
		return { client, router, run, screen, view };
	},
	inspect: ({ client, view }) => ({ checks: client.access.checks, html: view.container.innerHTML, requests: client.requests }),
	name: "refused live loader queries",
	stages: ["access", "screen"],
	verbs: ({ client, router, run, screen, view }, story) => {
		screen.tell = story.tell;
		function settled() {
			return settleScreen(
				view.container,
				() => router.state.isLoading || [...view.container.querySelectorAll("output")].some((output) => output.dataset.pending === "true"),
				story.tell,
			);
		}
		return {
			announce: () =>
				screen
					.act("the server announces changes to the private notes", () => Effect.runPromise(client.announce()))
					.pipe(Effect.andThen(settleScreen(view.container, () => view.container.querySelectorAll('[data-denied="true"]').length !== 3, story.tell))),
			changeInput: () =>
				screen.act("open the public note", () => router.navigate({ params: { id: "public" }, to: "/$id" })).pipe(Effect.andThen(settled())),
			denyRead: () =>
				Effect.sync(() => {
					story.tell("revoke access to the private notes");
					client.access.allowed = false;
				}),
			invalidate: () =>
				screen
					.act("matching changes arrive at the client", async () => {
						const reactivity = await Effect.runPromise(AtomRegistry.getResult(view.registry, client.clientReactivity));
						await Effect.runPromise(reactivity.invalidate(client.keys));
					})
					.pipe(Effect.andThen(settled())),
			minutePasses: () => screen.act("a minute passes with the queries mounted", () => run(TestClock.adjust("1 minute"))),
			policyChecks: () => Effect.sync(() => [...client.access.checks]),
			refuseReads: () =>
				Effect.sync(() => {
					story.tell("the query handler begins refusing reads");
					client.response.refused = true;
				}),
			requests: () => Effect.sync(() => [...client.requests]),
			shown: () => Effect.sync(() => view.container.querySelector("h1")?.textContent),
			states: () => Effect.sync(() => [...view.container.querySelectorAll("output")].map((output) => output.textContent)),
		};
	},
});
export function openedRoute() {
	return deniedLive.trait("screen", "open the private note route", function* ({ client, router, screen, view }) {
		yield* screen.act("mount the note route", () => view.render(<RouterProvider router={router} />));
		yield* settleScreen(
			view.container,
			() =>
				router.state.isLoading
				|| (client.access.allowed
					&& (view.container.querySelectorAll("output").length !== 3 || view.registry.get(client.status).connection !== "live")),
			screen.tell,
		);
	});
}
export function accessRevoked() {
	return deniedLive.trait("access", "access was revoked before the route opened", ({ client }) => {
		client.access.allowed = false;
	});
}
