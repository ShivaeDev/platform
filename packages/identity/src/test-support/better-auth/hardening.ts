import { Effect, Schema } from "effect";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { BetterAuthHardeningOptions } from "#server/better-auth/adapters/hardening.ts";
import { authRequest, CURRENT_PASSWORD, type HardeningHost, PASSWORD_HASH, startHardeningHost } from "./hardeningHost.ts";

interface Engine {
	hardening: BetterAuthHardeningOptions;
	headers: Headers;
	host?: HardeningHost;
	lastResponse?: { readonly body: unknown; readonly status: number };
	revokeSessions?: boolean;
}

function host(engine: Engine) {
	if (engine.host === undefined) {
		throw new Error("The hardening host has not started");
	}
	return engine.host;
}

const Session = Schema.NullOr(Schema.Struct({ user: Schema.Struct({ email: Schema.String }) }));

export const hardening = storyKit({
	after: {
		configured: Effect.fnUntraced(function* (engine: Engine) {
			engine.host = yield* startHardeningHost(engine.hardening, engine.revokeSessions);
		}),
	},
	around: withIsolatedDatabase,
	clock: "live",
	create: (): Engine => ({ hardening: {}, headers: new Headers() }),
	layer: postgres,
	name: "Better Auth account hardening",
	runIf: databaseUrl !== undefined,
	stages: ["configured", "account"],
	verbs: (engine, story) => ({
		changeEmail: (password?: unknown, native = false) =>
			Effect.promise(async () => {
				story.tell("alice requests a change to alice-new@example.test");
				const headers = new Headers(engine.headers);
				if (native) {
					const cookie = headers.get("cookie") ?? "";
					const signed = cookie
						.split(";")
						.find((part) => part.trim().startsWith("better-auth.session_token="))
						?.trim()
						.slice("better-auth.session_token=".length);
					headers.delete("cookie");
					headers.set("authorization", `Bearer ${decodeURIComponent(signed ?? "")}`);
				}
				const response = await authRequest(host(engine), "change-email", headers, { newEmail: "alice-new@example.test", password });
				const body: unknown = await response.json();
				engine.lastResponse = { body, status: response.status };
			}),
		currentPassword: () => Effect.succeed(CURRENT_PASSWORD),
		requestPasswordReset: () =>
			Effect.promise(async () => {
				story.tell("alice requests a password reset email");
				const response = await authRequest(host(engine), "request-password-reset", new Headers(), { email: "alice@example.test" });
				await response.text();
				return response.status;
			}),
		resetPassword: () =>
			Effect.promise(async () => {
				story.tell("alice resets her password through the emailed token");
				const link = host(engine).mailbox.get("reset");
				if (link === undefined) {
					throw new Error("No password reset email reached alice");
				}
				const token = new URL(link).pathname.split("/").at(-1);
				const response = await authRequest(host(engine), "reset-password", new Headers(), { newPassword: "alice-replacement-password", token });
				await response.text();
				return response.status;
			}),
		response: () => Effect.sync(() => engine.lastResponse),
		sessionEmail: () =>
			Effect.promise(async () => {
				const response = await authRequest(host(engine), "get-session", engine.headers);
				const session = Schema.decodeUnknownSync(Session)(await response.json());
				return session?.user.email ?? "signed out";
			}),
		verificationSent: () => Effect.sync(() => host(engine).mailbox.has("verification")),
	}),
});

export function signedInAlice({ password = true, verified = false } = {}) {
	return hardening.trait(
		"account",
		`alice is signed in with ${password ? "a password" : "no password"} and ${verified ? "a verified" : "an unverified"} email`,
		(engine) =>
			Effect.promise(async () => {
				const { test, internalAdapter } = await host(engine).auth.$context;
				const user = await test.saveUser(test.createUser({ email: "alice@example.test", emailVerified: verified, name: "alice" }));
				if (password) {
					await internalAdapter.createAccount({ accountId: user.id, password: PASSWORD_HASH, providerId: "credential", userId: user.id });
				}
				engine.headers = (await test.login({ userId: user.id })).headers;
			}),
	);
}

export const passwordCheckDisabled = hardening.trait("configured", "the app explicitly disables the email-change password check", (engine) => {
	engine.hardening = { requirePasswordForEmailChange: false };
});

export const resetRevocationDisabled = hardening.trait("configured", "the app explicitly retains sessions on password reset", (engine) => {
	engine.revokeSessions = false;
});
