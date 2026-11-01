import { DateTime, Deferred, type Duration, Effect, Fiber } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { AuthEmail } from "#server/better-auth/emails.ts";
import { signedInUser } from "#server/better-auth/testing.ts";
import { emailHost } from "./emailHost.ts";

interface Engine {
	headers: Headers;
	host?: Effect.Success<ReturnType<typeof emailHost>>;
	window?: Duration.Input;
}

function host(engine: Engine) {
	if (engine.host === undefined) {
		throw new Error("Email story auth has not started");
	}
	return engine.host;
}

function request(engine: Engine, kind: AuthEmail["_tag"], person = "alice"): Promise<unknown> {
	const { auth, messages } = host(engine);
	const email = `${person}@example.test`;
	switch (kind) {
		case "ConfirmAccount":
			return auth.api.sendVerificationEmail({ body: { email } });
		case "ResetPassword":
			return auth.api.requestPasswordReset({ body: { email } });
		case "ApproveEmailChange":
			return auth.api.changeEmail({ body: { newEmail: "alice-new@example.test" }, headers: engine.headers });
		case "ConfirmNewAddress": {
			const approval = messages.find((message) => message._tag === "ApproveEmailChange");
			if (approval?._tag !== "ApproveEmailChange") {
				throw new Error("Alice has no email change to approve");
			}
			return auth.api.verifyEmail({ query: { token: approval.token } });
		}
		case "AccountAlreadyExists":
			return auth.api.signUpEmail({ body: { email, name: person, password: "unused-signup-password" } });
	}
}

export const emails = storyKit({
	after: {
		configured: Effect.fnUntraced(function* (engine: Engine) {
			engine.host = yield* emailHost(engine.window);
		}),
	},
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	create: (): Engine => ({ headers: new Headers() }),
	layer: postgres,
	name: "typed auth emails",
	runIf: databaseUrl !== undefined,
	stages: ["configured", "account", "delivery", "approval"],
	verbs: (engine, story) => {
		let pending: Effect.Effect<unknown> | undefined;
		return {
			beginRequest: (kind: AuthEmail["_tag"]) =>
				Effect.gen(function* () {
					story.tell(`alice requests ${kind} while the mail transport holds delivery`);
					const fiber = yield* Effect.promise(() => request(engine, kind)).pipe(Effect.forkScoped);
					pending = Fiber.join(fiber);
					yield* Deferred.await(host(engine).started);
				}),
			changeEmailTo: (newEmail: string) => {
				story.tell(`alice requests a change to ${newEmail}`);
				return Effect.promise(() => host(engine).auth.api.changeEmail({ body: { newEmail }, headers: engine.headers }));
			},
			deliveryAvailable: (available: boolean) =>
				Effect.sync(() => {
					host(engine).delivery.available = available;
				}),
			finishDelivery: () =>
				Effect.gen(function* () {
					story.tell("the mail transport finishes the held delivery");
					yield* Deferred.succeed(host(engine).release, undefined);
					if (pending === undefined) {
						return yield* Effect.die("No mail request is in flight");
					}
					yield* pending;
				}),
			messages: (kind: AuthEmail["_tag"]) => Effect.sync(() => host(engine).messages.filter((message) => message._tag === kind)),
			request: (kind: AuthEmail["_tag"], person = "alice") => {
				story.tell(`${person} requests ${kind}`);
				return Effect.promise(() => request(engine, kind, person));
			},
			timePasses: (duration: Duration.Input) => {
				story.tell(`${duration} pass on the email window clock`);
				return TestClock.adjust(duration);
			},
		};
	},
});

export function aliceAccount(verified = false) {
	return emails.trait("account", `alice has ${verified ? "a verified" : "an unverified"} account`, (engine) =>
		signedInUser(host(engine).auth, { email: "alice@example.test", emailVerified: verified, name: "alice" }).pipe(
			Effect.tap((account) =>
				Effect.sync(() => {
					engine.headers = account.headers;
				}),
			),
		),
	);
}
export const bobAccount = emails.trait("account", "bob has his own account", (engine) =>
	signedInUser(host(engine).auth, { email: "bob@example.test", name: "bob" }).pipe(Effect.asVoid),
);
export const approvalRequested = emails.trait("approval", "alice has requested an email change", (engine) =>
	Effect.promise(() => request(engine, "ApproveEmailChange")),
);
export const twoMinuteWindow = emails.trait("configured", "the app chooses a two minute email window", (engine) => {
	engine.window = "2 minutes";
});
export const deliveryHeld = emails.trait("delivery", "the app's mail transport holds delivery", (engine) => {
	host(engine).delivery.held = true;
});
