import { Effect, Schema } from "effect";
import { emailLink } from "@shivaedev/test-kits/email/adapters/inbox.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { AuthEmailKind } from "#server/authEmailCopy.ts";
import type { AuthEmailQueueOptions } from "#server/authEmailQueue.ts";
import { authEmailHost } from "#test/authEmailHost.ts";
import { configured, postgres } from "#test/fixture.ts";

interface AuthEmailEngine {
	approvalToken?: string;
	copy?: AuthEmailQueueOptions["copy"];
	headers: Headers;
	host?: Effect.Success<ReturnType<typeof authEmailHost>>;
}

const Refusal = Schema.Struct({ code: Schema.String });

function started(engine: AuthEmailEngine) {
	if (engine.host === undefined) {
		throw new Error("The auth email host has not started");
	}
	return engine.host;
}

function send(engine: AuthEmailEngine, kind: AuthEmailKind): Promise<Response> {
	const { baseUrl } = started(engine);
	const email = "alice@example.test";
	function post(path: string, body: object, headers: HeadersInit = {}) {
		return fetch(`${baseUrl}/api/auth/${path}`, {
			body: JSON.stringify(body),
			headers: { ...Object.fromEntries(new Headers(headers)), "content-type": "application/json", origin: baseUrl },
			method: "POST",
		});
	}
	switch (kind) {
		case "ConfirmAccount":
			return post("send-verification-email", { email });
		case "ResetPassword":
			return post("request-password-reset", { email });
		case "AccountAlreadyExists":
			return post("sign-up/email", { email, name: "alice", password: "unused-signup-password" });
		case "ApproveEmailChange":
			return post("change-email", { newEmail: "alice-new@example.test" }, engine.headers);
		case "ConfirmNewAddress":
			if (engine.approvalToken === undefined) {
				throw new Error("Alice has no email change to approve");
			}
			return fetch(`${baseUrl}/api/auth/verify-email?${new URLSearchParams({ token: engine.approvalToken })}`, { redirect: "manual" });
	}
}

function answer(response: Response) {
	return Effect.promise(async () => {
		if (response.ok) {
			await response.text();
			return "accepted";
		}
		return `refused: ${Schema.decodeUnknownSync(Refusal)(await response.json()).code}`;
	});
}

export const authEmails = storyKit({
	after: {
		configured: Effect.fnUntraced(function* (engine: AuthEmailEngine) {
			engine.host = yield* authEmailHost(engine.copy);
		}),
	},
	around: withIsolatedDatabase,
	clock: "test",
	create: (): AuthEmailEngine => ({ headers: new Headers() }),
	inspect: () => ({}),
	layer: postgres,
	name: "auth emails queued through the email worker",
	runIf: configured,
	stages: ["configured", "account", "approval", "queue"],
	verbs: (engine, story) => ({
		nextEmail: () =>
			Effect.gen(function* () {
				const { jobs, mail } = started(engine);
				yield* jobs.waitForIdle;
				const email = yield* mail.nextEmail;
				const { from, html, subject, text, to } = email;
				const link = emailLink(email);
				const url = new URL(link);
				return { address: `${url.origin}${url.pathname}`, from, html, link, subject, text, to, token: url.searchParams.get("token") !== null };
			}),
		request: (kind: AuthEmailKind) => {
			story.tell(`alice requests ${kind}`);
			return Effect.promise(() => send(engine, kind)).pipe(Effect.flatMap(answer));
		},
	}),
});

export function aliceAccount(verified: boolean) {
	return authEmails.trait("account", `alice has ${verified ? "a verified" : "an unverified"} account and is signed in`, (engine) =>
		Effect.promise(async () => {
			const { test } = await started(engine).auth.$context;
			const user = await test.saveUser(test.createUser({ email: "alice@example.test", emailVerified: verified, name: "alice" }));
			engine.headers = (await test.login({ userId: user.id })).headers;
		}),
	);
}

export const approvalRequested = authEmails.trait(
	"approval",
	"alice asked to change her address to alice-new@example.test and received the approval email",
	(engine) =>
		Effect.gen(function* () {
			const response = yield* Effect.promise(() => send(engine, "ApproveEmailChange"));
			yield* answer(response);
			const { jobs, mail } = started(engine);
			yield* jobs.waitForIdle;
			const approval = new URL(emailLink(yield* mail.nextEmail));
			engine.approvalToken = approval.searchParams.get("token") ?? undefined;
		}),
);

export const resetCopy = authEmails.trait("configured", "the app writes its own password reset copy", (engine) => {
	engine.copy = {
		ResetPassword: () => ({ action: "Choose a password", lines: ["Pick a new Example password."], subject: "Reset your Example password" }),
	};
});

export const queueUnavailable = authEmails.trait("queue", "the auth email queue refuses the next job", (engine) => {
	const { jobs, queue } = started(engine);
	return jobs.failNextSend(queue);
});
