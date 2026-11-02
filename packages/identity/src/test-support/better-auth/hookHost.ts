import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { testUtils } from "better-auth/plugins";
import { Cause, ConfigProvider, Effect } from "effect";
import { HttpMiddleware, HttpRouter, HttpServerRequest } from "effect/http";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
import { recorder } from "#test/rpc/harness.ts";
import { CURRENT_PASSWORD, PASSWORD_HASH } from "./hardeningHost.ts";
import { Admission, type HookApplication, userCreationHooks } from "./hookApplication.ts";

const ORIGIN = "http://localhost:3000";

function recordDefects(cause: Cause.Cause<unknown>, defects: string[]) {
	return Effect.sync(() => {
		for (const reason of cause.reasons) {
			if (Cause.isDieReason(reason) && reason.defect instanceof Error) {
				defects.push(String(reason.defect));
			}
		}
	});
}

export const hookHost = Effect.fnUntraced(function* (application: HookApplication) {
	const recorded = recorder();
	const storage = yield* authTestDatabase;
	const defects: string[] = [];
	const resetTokens = new Map<string, string>();
	const resetHooks: string[] = [];
	const options = {
		"baseURL": ORIGIN,
		database: yield* betterAuthDatabase(),
		databaseHooks: {
			session: { create: { before: async () => (application.state.nativeRefuses ? false : undefined) } },
			user: { create: { before: async (user: { name: string }) => ({ data: { name: `native ${user.name}` } }) } },
		},
		emailAndPassword: {
			enabled: true,
			onPasswordReset: ({ user }: { user: { name: string } }) => {
				resetHooks.push(`native ${user.name}`);
				return Promise.resolve();
			},
			sendResetPassword: ({ user, token }: { user: { email: string }; token: string }) => {
				resetTokens.set(user.email, token);
				return Promise.resolve();
			},
		},
		logger: { disabled: true },
		plugins: [testUtils()],
		secret: "effect-hooks-story-secret-at-least-32-characters",
	};
	yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
	const mounted = yield* betterAuthMount(options, {
		databaseHooks: application.state.userHooks ? userCreationHooks(application.state.userTransforms) : application.hooks,
		onPasswordReset: ({ user }) =>
			Effect.gen(function* () {
				const admission = yield* Admission;
				yield* admission.check(user.id);
				resetHooks.push(`effect ${user.name}`);
			}),
		signIn: application.state.policyRefuses ? { rule: () => Effect.succeed(false) } : undefined,
	})
		.pipe(Effect.provide(memoryStore))
		.pipe(
			Effect.provideService(Admission, application.admission("nobody at mount time")),
			Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))),
		);
	const app = HttpRouter.toWebHandler(mounted.routes, {
		disableLogger: true,
		middleware: (handler) =>
			Effect.gen(function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				return yield* HttpMiddleware.tracer(handler).pipe(
					Effect.provideService(Admission, application.admission(request.headers["x-member"] ?? "alice")),
					Effect.annotateLogs({ requestId: request.headers["x-request-id"] }),
					Effect.tapCause((cause) => recordDefects(cause, defects)),
				);
			}).pipe(Effect.provide(recorded.layer)),
	});
	yield* Effect.addFinalizer(() => Effect.promise(() => app.dispose()));
	const fixtures = betterAuth({ ...options, databaseHooks: undefined });
	return {
		defects,
		directReset: (token: string) => mounted.auth.api.resetPassword({ asResponse: true, body: { newPassword: "replacement-password", token } }),
		directSignIn: (person: string) => mounted.auth.api.signInEmail({ asResponse: true, body: credentials(person) }),
		logs: () => recorded.logs.filter(({ message }) => Array.isArray(message) && message.includes("Application session admitted")),
		request: (path: string, body: object, signal?: AbortSignal, member = "alice") =>
			app.handler(
				new Request(`${ORIGIN}/api/auth/${path}`, {
					body: JSON.stringify(body),
					headers: { "content-type": "application/json", origin: ORIGIN, "x-member": member, "x-request-id": "application-sign-in" },
					method: "POST",
					...(signal === undefined ? {} : { signal }),
				}),
			),
		resetHooks,
		resetToken: (person: string) => {
			const token = resetTokens.get(`${person}@hooks.test`);
			if (token === undefined) {
				throw new Error(`No reset email reached ${person}`);
			}
			return token;
		},
		seed: (person: string) =>
			Effect.promise(async () => {
				const { test, internalAdapter } = await fixtures.$context;
				const user = await test.saveUser(test.createUser({ email: `${person}@hooks.test`, name: person }));
				await internalAdapter.createAccount({ accountId: user.id, password: PASSWORD_HASH, providerId: "credential", userId: user.id });
				application.users.set(user.id, person);
			}),
		session: (cookie: string) =>
			app.handler(new Request(`${ORIGIN}/api/auth/get-session`, { headers: { cookie } })).then((response) => response.json()),
		spans: recorded.spans,
		storedSessions: Effect.map(storage.sessions, (rows) => rows.map(({ email }) => email)),
		userCreations: () =>
			recorded.logs.filter(({ message }) => Array.isArray(message) && message.includes("Application user created")).map(({ message }) => message),
	};
});

export function credentials(person: string) {
	return { email: `${person}@hooks.test`, password: CURRENT_PASSWORD };
}
export type HookHost = Effect.Success<ReturnType<typeof hookHost>>;
