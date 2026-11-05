import { Deferred, type Duration, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { postgresMigration } from "@shivaedev/rate-limit/adapters/postgresMigration.ts";
import { postgresTestDatabase } from "@shivaedev/rate-limit/postgresTestDatabase.ts";
import { signedInUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { AuthEmail } from "#server/better-auth/emails.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";
import { emailHost } from "./emailHost.ts";
import { type EmailEngine, emailEngineHost, requestEmail } from "./emailRequests.ts";

export const emails = storyKit({
	after: {
		configured: Effect.fnUntraced(function* (engine: EmailEngine) {
			engine.host = yield* emailHost(engine.window, [], engine.windows);
		}),
	},
	around: withIdentityDatabase,
	clock: storyClock,
	*create() {
		yield* postgresMigration;
		const engine: EmailEngine = { headers: new Headers() };
		return engine;
	},
	layer: postgres,
	name: "typed auth emails",
	runIf: databaseUrl !== undefined,
	stages: ["configured", "account", "mounts", "delivery", "approval"],
	verbs: (engine, story) => {
		let pending: Effect.Effect<unknown> | undefined;
		return {
			beginRequest: (kind: AuthEmail["_tag"]) =>
				Effect.gen(function* () {
					story.tell(`alice requests ${kind} while the mail transport holds delivery`);
					const fiber = yield* Effect.promise(() => requestEmail(engine, kind)).pipe(Effect.forkScoped);
					pending = Fiber.join(fiber);
					yield* Deferred.await(emailEngineHost(engine).started);
				}),
			changeEmailTo: (newEmail: string) => {
				story.tell(`alice requests a change to ${newEmail}`);
				return Effect.promise(() => emailEngineHost(engine).auth.api.changeEmail({ body: { newEmail }, headers: engine.headers }));
			},
			deliveryAvailable: (available: boolean) =>
				Effect.sync(() => {
					emailEngineHost(engine).delivery.available = available;
				}),
			deliveryLogs: () => Effect.sync(() => JSON.stringify(emailEngineHost(engine).recorded.logs)),
			deliveryTraces: () => Effect.sync(() => JSON.stringify(emailEngineHost(engine).recorded.spans.map((span) => [...span.attributes]))),
			emailWindowPasses: (duration: Duration.Input) => {
				story.tell(`${duration} passes for the stored email reservations`);
				return TestClock.adjust(duration).pipe(
					Effect.andThen(postgresTestDatabase.pipe(Effect.flatMap((database) => database.elapseWindows(duration)))),
				);
			},
			expireWindows: () => {
				story.tell("the stored email reservations expire");
				return postgresTestDatabase.pipe(Effect.flatMap((database) => database.expireWindows));
			},
			finishDelivery: () =>
				Effect.gen(function* () {
					story.tell("the mail transport finishes the held delivery");
					yield* Deferred.succeed(emailEngineHost(engine).release, undefined);
					if (pending === undefined) {
						return yield* Effect.die("No mail request is in flight");
					}
					yield* pending;
				}),
			messages: (kind: AuthEmail["_tag"]) => Effect.sync(() => emailEngineHost(engine).messages.filter((message) => message._tag === kind)),
			rebuildMount: () =>
				Effect.gen(function* () {
					story.tell("the first mount shuts down and is rebuilt against the same database");
					const previous = emailEngineHost(engine);
					yield* previous.stop;
					engine.host = yield* emailHost(engine.window, previous.messages, engine.windows);
				}),
			request: (kind: AuthEmail["_tag"], person = "alice", replica: "first" | "second" = "first") => {
				story.tell(`${person} requests ${kind} on the ${replica} mount`);
				return Effect.promise(async () => (await requestEmail(engine, kind, person, replica)).status);
			},
		};
	},
});

export function aliceAccount(verified = false) {
	return emails.trait("account", `alice has ${verified ? "a verified" : "an unverified"} account`, (engine) =>
		signedInUser(emailEngineHost(engine).auth, { email: "alice@example.test", emailVerified: verified, name: "alice" }).pipe(
			Effect.tap((account) =>
				Effect.sync(() => {
					engine.headers = account.headers;
				}),
			),
		),
	);
}
export const bobAccount = emails.trait("account", "bob has his own account", (engine) =>
	signedInUser(emailEngineHost(engine).auth, { email: "bob@example.test", name: "bob" }).pipe(Effect.asVoid),
);
export const approvalRequested = emails.trait("approval", "alice has requested an email change", (engine) =>
	Effect.promise(() => requestEmail(engine, "ApproveEmailChange")),
);
export const twoMinuteWindow = emails.trait("configured", "the app chooses a two minute email window", (engine) => {
	engine.window = "2 minutes";
});
export const differentWindows = emails.trait(
	"configured",
	"confirmations wait two minutes, resets wait four, and other kinds use the three minute default",
	(engine) => {
		engine.window = "3 minutes";
		engine.windows = { ConfirmAccount: "2 minutes", ResetPassword: "4 minutes" };
	},
);
export const deliveryHeld = emails.trait("delivery", "the app's mail transport holds delivery", (engine) => {
	emailEngineHost(engine).delivery.held = true;
});

export const twoMounts = emails.trait("mounts", "two mounts share PostgreSQL through independent pools", function* (engine) {
	engine.second = yield* emailHost(engine.window, emailEngineHost(engine).messages, engine.windows);
});
