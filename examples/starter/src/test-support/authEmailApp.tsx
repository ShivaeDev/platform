import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { ConfigProvider, Effect, Layer, Schema } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { emailLink, inbox } from "@shivaedev/email/server/testing/adapters/inbox.ts";
import { signedInUser } from "@shivaedev/identity/server/better-auth/testing.ts";
import { makePgBossTesting } from "@shivaedev/jobs/server/testing.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appRouter } from "#client/appRouter.tsx";
import { makeAuth } from "#client/auth.ts";
import { applicationWorker } from "#server/applicationWorker.ts";
import { JobsClientFactory } from "#server/JobsClientFactory.ts";
import { startHost } from "#test-support/host.ts";
import { testPoolSizes } from "#test-support/poolSizes.ts";
import { postgres } from "#test-support/postgres.ts";
import { acquireScreen, type ScreenSurface, screenView } from "#test-support/screenState.ts";
import { sessionPrecondition } from "#test-support/sessionPrecondition.ts";

const decodeSession = Schema.decodeUnknownSync(Schema.Struct({ user: Schema.Struct({ emailVerified: Schema.Boolean }) }));

export const authEmailApp = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const mail = yield* inbox();
		const host = yield* startHost();
		const database = yield* PostgresTestDatabase;
		const testing = makePgBossTesting();
		const workerConfig = ConfigProvider.layer(
			ConfigProvider.fromEnv({
				env: {
					"EMAIL_FROM": "Accounts <accounts@app.test>",
					"NODE_ENV": "production",
					"RESEND_API_KEY": "re_story",
				},
			}),
		);
		yield* Layer.build(
			applicationWorker({
				databaseUrl: database.url,
				poolSizes: testPoolSizes,
				replacements: Layer.succeed(JobsClientFactory, testing.clientFactory),
			}).pipe(Layer.provide(workerConfig)),
		);
		const precondition = yield* sessionPrecondition(host);
		const alice = yield* signedInUser(precondition, { email: "alice@app.test", emailVerified: false, name: "alice" });
		const auth = makeAuth({ baseUrl: host.baseUrl });
		const surface: ScreenSurface = { view: undefined };
		return { alice, auth, host, mail, surface, testing };
	},
	layer: postgres,
	name: "auth emails",
	stages: [],
	verbs: (engine, story) => {
		const { host, mail, testing, surface, auth } = engine;
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
				testing.waitForIdle.pipe(
					Effect.andThen(mail.emails()),
					Effect.map((emails) =>
						emails.map((email) => {
							const link = new URL(emailLink(email));
							return `${email.subject} for ${email.to} at ${link.origin}${link.pathname}`;
						}),
					),
				),
			followsConfirmationLink: () =>
				Effect.gen(function* () {
					const link = new URL(emailLink(yield* mail.nextEmail));
					return yield* Effect.promise(async () => {
						story.tell("alice follows the link in her confirmation email");
						const response = await fetch(`${host.baseUrl}${link.pathname}${link.search}`, { redirect: "manual" });
						await response.text();
						const location = response.headers.get("location");
						if (location === null) {
							throw new Error("The app did not forward the confirmation token");
						}
						const confirmed = await fetch(new URL(location, host.baseUrl), { redirect: "manual" });
						await confirmed.text();
						return confirmed.headers.get("location") ?? `no redirect, HTTP ${confirmed.status}`;
					});
				}),
			opensResetLink: () =>
				Effect.gen(function* () {
					story.tell("alice opens the link in her password reset email");
					const link = new URL(emailLink(yield* mail.nextEmail));
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
