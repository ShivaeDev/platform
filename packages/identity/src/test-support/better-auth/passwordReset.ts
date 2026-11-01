import { Effect, Schema } from "effect";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { hookApplication } from "./hookApplication.ts";
import { hookHost } from "./hookHost.ts";

const ErrorBody = Schema.Struct({ code: Schema.String, message: Schema.String });

export const passwordResets = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const application = yield* hookApplication;
		const host = yield* hookHost(application);
		return { application, host };
	},
	layer: postgres,
	name: "application password reset Effects",
	runIf: databaseUrl !== undefined,
	stages: ["account", "email"],
	verbs: ({ application, host }, story) => ({
		cancelReset: (person: string) => {
			story.tell(`${person} cancels the reset while the application Effect waits`);
			return application.probe.cancel(
				Effect.tryPromise((signal) =>
					host.request("reset-password", { newPassword: "replacement-password", token: host.resetToken(person) }, signal, person),
				),
			);
		},
		hookInterrupted: () => application.probe.waitForInterruption.pipe(Effect.as("interrupted")),
		recordedResetHooks: () => Effect.sync(() => [...host.resetHooks]),
		resetPassword: (person: string, member = person, direct = false) => {
			story.tell(`${person} resets their password ${direct ? "through auth.api" : `with ${member}'s request service`}`);
			return Effect.promise(async () => {
				const token = host.resetToken(person);
				const response = direct
					? await host.directReset(token)
					: await host.request("reset-password", { newPassword: "replacement-password", token }, undefined, member);
				const body: unknown = await response.json();
				return response.ok ? { status: response.status } : { ...Schema.decodeUnknownSync(ErrorBody)(body), status: response.status };
			});
		},
	}),
});

export const bobResetEmail = passwordResets.trait("email", "bob has received a password reset email", function* ({ host }) {
	const response = yield* Effect.promise(() => host.request("request-password-reset", { email: "bob@hooks.test" }));
	yield* Effect.promise(() => response.text());
});

export const bobAccount = passwordResets.trait("account", "bob already has a password account", ({ host }) => host.seed("bob"));

export const waitingReset = passwordResets.trait("email", "the application's reset Effect waits", ({ application }) => {
	application.probe.waiting = true;
});
