import { Effect, Schema } from "effect";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { hookApplication } from "./hookApplication.ts";
import { credentials, type HookHost, hookHost } from "./hookHost.ts";

const Session = Schema.NullOr(Schema.Struct({ user: Schema.Struct({ email: Schema.String, name: Schema.String }) }));
const ErrorBody = Schema.Struct({ code: Schema.String, message: Schema.String });

interface Engine {
	readonly application: Effect.Success<typeof hookApplication>;
	cookie: string;
	host?: HookHost;
}

function host(engine: Engine) {
	if (engine.host === undefined) {
		throw new Error("The Effect hook host has not started");
	}
	return engine.host;
}

function answer(engine: Engine, response: Response) {
	return Effect.promise(async () => {
		engine.cookie = response.headers
			.getSetCookie()
			.map((cookie) => cookie.split(";")[0])
			.join("; ");
		if (response.body === null) {
			await response.text();
			return { status: response.status };
		}
		const body: unknown = await response.json();
		return response.ok ? { status: response.status } : { ...Schema.decodeUnknownSync(ErrorBody)(body), status: response.status };
	});
}

export const effectHooks = storyKit({
	after: {
		*configured(engine: Engine) {
			engine.host = yield* hookHost(engine.application);
		},
	},
	around: withIsolatedDatabase,
	clock: "live",
	create: () => Effect.map(hookApplication, (application): Engine => ({ application, cookie: "" })),
	layer: postgres,
	name: "application Better Auth Effects",
	runIf: databaseUrl !== undefined,
	stages: ["configured", "accounts"],
	verbs: (engine, story) => ({
		cancelSignIn: (person: string) => {
			story.tell(`${person} cancels sign-in while the application hook waits`);
			return engine.application.probe.cancel(Effect.tryPromise((signal) => host(engine).request("sign-in/email", credentials(person), signal)));
		},
		directSignIn: (person: string) => {
			story.tell(`${person} signs in through auth.api without a mounted HTTP request`);
			return Effect.promise(() => host(engine).directSignIn(person)).pipe(Effect.flatMap((response) => answer(engine, response)));
		},
		hookInterrupted: () => engine.application.probe.waitForInterruption.pipe(Effect.as("interrupted")),
		hookLogs: () =>
			Effect.sync(() =>
				host(engine)
					.logs()
					.map(({ annotations, traceId }) => ({ requestId: annotations.requestId, traceId })),
			),
		hookSpans: () =>
			Effect.sync(() =>
				host(engine)
					.spans.filter(({ name }) => name === "application.session-hook")
					.map(({ parent, traceId }) => ({
						parent: parent._tag === "Some" && parent.value._tag === "Span" ? parent.value.name : undefined,
						traceId,
					})),
			),
		requestDefects: () => Effect.sync(() => [...host(engine).defects]),
		session: () =>
			Effect.promise(async () => {
				const session = Schema.decodeUnknownSync(Session)(await host(engine).session(engine.cookie));
				return session?.user ?? "signed out";
			}),
		signIn: (person: string, member = "alice") => {
			story.tell(`${person} signs in through the application's session hook`);
			return Effect.promise(() => host(engine).request("sign-in/email", credentials(person), undefined, member)).pipe(
				Effect.flatMap((response) => answer(engine, response)),
			);
		},
		signUp: (person: string) => {
			story.tell(`${person} creates an account through the application's user hooks`);
			return Effect.promise(() => host(engine).request("sign-up/email", { ...credentials(person), name: person })).pipe(
				Effect.flatMap((response) => answer(engine, response)),
			);
		},
		storedSessions: () => host(engine).storedSessions,
		userCreations: () => Effect.sync(() => host(engine).userCreations()),
	}),
});

export const passwordAccounts = effectHooks.trait("accounts", "alice and bob already have password accounts", function* (engine) {
	yield* host(engine).seed("alice");
	yield* host(engine).seed("bob");
});

export const defectiveHook = effectHooks.trait("configured", "the application's session hook has a defect", (engine) => {
	engine.application.state.defective = true;
});

export const waitingHook = effectHooks.trait("accounts", "the application's session hook waits", (engine) => {
	engine.application.probe.waiting = true;
});

export const userHooks = effectHooks.trait("configured", "the application also transforms and observes new users as Effects", (engine) => {
	engine.application.state.userHooks = true;
});

export const unchangedUserHook = effectHooks.trait("configured", "the application's user Effect returns true without changing the user", (engine) => {
	engine.application.state.userTransforms = false;
});

export const refusingPolicy = effectHooks.trait("configured", "identity's sign-in policy refuses every account", (engine) => {
	engine.application.state.policyRefuses = true;
});

export const nativeRefusal = effectHooks.trait("configured", "the native session hook refuses creation", (engine) => {
	engine.application.state.nativeRefuses = true;
});
