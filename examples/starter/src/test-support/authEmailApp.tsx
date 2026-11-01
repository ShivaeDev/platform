import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import type { AuthEmail } from "@shivaedev/identity/server/better-auth/emails.ts";
import { signedInUser } from "@shivaedev/identity/server/better-auth/testing.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appRouter } from "#client/appRouter.tsx";
import { makeAuth } from "#client/auth.ts";
import { startHost } from "#test-support/host.ts";
import { postgres } from "#test-support/postgres.ts";
import { acquireScreen, type ScreenSurface, screenView } from "#test-support/screenState.ts";
import { sessionPrecondition } from "#test-support/sessionPrecondition.ts";

export const authEmailApp = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const messages: AuthEmail[] = [];
		const host = yield* startHost({
			deliverAuthEmail: (message) =>
				Effect.sync(() => {
					messages.push(message);
				}),
		});
		const precondition = yield* sessionPrecondition(host);
		const alice = yield* signedInUser(precondition, { email: "alice@app.test", emailVerified: false, name: "alice" });
		const auth = makeAuth({ baseUrl: host.baseUrl });
		const surface: ScreenSurface = { view: undefined };
		return { alice, auth, host, messages, surface };
	},
	layer: postgres,
	name: "starter auth emails",
	stages: [],
	verbs: (engine, story) => {
		const { host, messages, surface, auth } = engine;
		let confirmation: { readonly location: string | null; readonly status: number } | undefined;
		function message(kind: AuthEmail["_tag"]) {
			const delivered = messages.find((mail) => mail._tag === kind);
			if (delivered === undefined) {
				throw new Error(`No ${kind} email was delivered`);
			}
			return delivered;
		}
		const driver = screenDriver({
			act,
			pending: () => surface.view?.registry.get(auth.actions.resetPassword).waiting ?? false,
			root: () => screenView(surface).container,
			tell: story.tell,
		});
		return {
			click: driver.click,
			confirmation: () => Effect.sync(() => confirmation),
			enter: driver.enter,
			followConfirmation: () =>
				Effect.promise(async () => {
					story.tell("alice follows the app's confirmation route");
					const link = new URL(message("ConfirmAccount").url);
					const response = await fetch(`${host.baseUrl}${link.pathname}${link.search}`, { redirect: "manual" });
					await response.text();
					const location = response.headers.get("location");
					if (location === null) {
						throw new Error("The app did not forward the confirmation token");
					}
					const confirmed = await fetch(new URL(location, host.baseUrl), { redirect: "manual" });
					await confirmed.text();
					confirmation = { location: confirmed.headers.get("location"), status: confirmed.status };
				}),
			messages: () => Effect.sync(() => [...messages]),
			openReset: () =>
				Effect.gen(function* () {
					story.tell("alice opens the app route in her password reset email");
					const link = new URL(message("ResetPassword").url);
					const view = yield* acquireScreen(surface);
					const router = yield* appRouter(
						{ modules: [] },
						auth.actions,
						createMemoryHistory({ initialEntries: [`${link.pathname}${link.search}`] }),
					).pipe(Effect.provideService(AtomRegistry.AtomRegistry, view.registry));
					yield* Effect.promise(async () => {
						await view.render(<RouterProvider router={router} />);
						await act(() => router.load());
					});
				}),
			request: (kind: "ConfirmAccount" | "ResetPassword") =>
				Effect.promise(async () => {
					story.tell(`alice requests ${kind}`);
					const path = kind === "ConfirmAccount" ? "send-verification-email" : "request-password-reset";
					const response = await fetch(`${host.baseUrl}/api/auth/${path}`, {
						body: JSON.stringify({ email: "alice@app.test" }),
						headers: { "content-type": "application/json", origin: host.baseUrl },
						method: "POST",
					});
					await response.text();
					return response.status;
				}),
			screenText: () => Effect.sync(() => screenView(surface).container.textContent),
			session: () =>
				Effect.promise(async () => {
					const response = await fetch(`${host.baseUrl}/api/auth/get-session`, { headers: engine.alice.headers });
					return response.json();
				}),
			settle: driver.settle,
			signIn: (password: string) => Effect.promise(() => auth.client.signIn.email({ email: "alice@app.test", password })),
		};
	},
});
