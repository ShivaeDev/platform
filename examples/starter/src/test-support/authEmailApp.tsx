import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import type { AuthEmail } from "@shivaedev/identity/server/better-auth/emails.ts";
import { signedInUser } from "@shivaedev/identity/server/better-auth/testing.ts";
import { words } from "@shivaedev/test/answers.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appRouter } from "#client/appRouter.tsx";
import { makeAuth } from "#client/auth.ts";
import { startHost } from "#test-support/host.ts";
import { postgres } from "#test-support/postgres.ts";
import { acquireScreen, type ScreenSurface, screenView } from "#test-support/screenState.ts";
import { sessionPrecondition } from "#test-support/sessionPrecondition.ts";

const decodeSession = Schema.decodeUnknownSync(Schema.Struct({ user: Schema.Struct({ emailVerified: Schema.Boolean }) }));

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
	name: "auth emails",
	stages: [],
	verbs: (engine, story) => {
		const { host, messages, surface, auth } = engine;
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
		function request(kind: "ConfirmAccount" | "ResetPassword") {
			return Effect.promise(async () => {
				const path = kind === "ConfirmAccount" ? "send-verification-email" : "request-password-reset";
				const response = await fetch(`${host.baseUrl}/api/auth/${path}`, {
					body: JSON.stringify({ email: "alice@app.test" }),
					headers: { "content-type": "application/json", origin: host.baseUrl },
					method: "POST",
				});
				await response.text();
			});
		}
		return {
			account: () =>
				Effect.promise(async () => {
					const response = await fetch(`${host.baseUrl}/api/auth/get-session`, { headers: engine.alice.headers });
					const session = decodeSession(await response.json());
					return session.user.emailVerified ? "verified" : "unverified";
				}),
			changesPassword: (password: string) =>
				Effect.gen(function* () {
					yield* driver.enter('input[type="password"]', password);
					yield* driver.click({ name: "Change password", role: "button" });
					yield* driver.settle();
				}),
			deliveredEmails: () =>
				Effect.sync(() =>
					messages.map((mail) => {
						const link = new URL(mail.url);
						return `${words(mail._tag)} for ${mail.user.email} at ${link.origin}${link.pathname}`;
					}),
				),
			followsConfirmationLink: () =>
				Effect.promise(async () => {
					story.tell("alice follows the link in her confirmation email");
					const link = new URL(message("ConfirmAccount").url);
					const response = await fetch(`${host.baseUrl}${link.pathname}${link.search}`, { redirect: "manual" });
					await response.text();
					const location = response.headers.get("location");
					if (location === null) {
						throw new Error("The app did not forward the confirmation token");
					}
					const confirmed = await fetch(new URL(location, host.baseUrl), { redirect: "manual" });
					await confirmed.text();
					return confirmed.headers.get("location") ?? `no redirect, HTTP ${confirmed.status}`;
				}),
			opensResetLink: () =>
				Effect.gen(function* () {
					story.tell("alice opens the link in her password reset email");
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
					yield* driver.settle();
				}),
			requestsConfirmation: () => {
				story.tell("alice asks for a confirmation email");
				return request("ConfirmAccount");
			},
			requestsPasswordReset: () => {
				story.tell("alice asks for a password reset email");
				return request("ResetPassword");
			},
			screenStatus: () => Effect.sync(() => screenView(surface).container.querySelector("[role=status]")?.textContent ?? "no status"),
			signsIn: (password: string) =>
				Effect.promise(async () => {
					story.tell("alice signs in with her new password");
					const { data, error } = await auth.client.signIn.email({ email: "alice@app.test", password });
					return error === null ? `signed in as ${data.user.email}` : `refused: ${error.message}`;
				}),
		};
	},
});
