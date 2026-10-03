import { inspect } from "node:util";
import { Cause, Effect, ErrorReporter, Exit, Layer, Schema } from "effect";
import { Headers } from "effect/unstable/http";
import { Rpc, RpcGroup, RpcTest } from "effect/unstable/rpc";
import { expect, test } from "vitest";
import { RequestTracing } from "../src/rpc.ts";
import { betterAuthSessions, redact, redactingErrorReporter, requestTracingLayer } from "../src/rpc-server.ts";
import { recorder } from "./rpc/support.ts";

const leaks = (value: unknown, secrets: ReadonlyArray<string>) => {
	const rendered = inspect(value, { depth: 20 });
	return secrets.filter((secret) => rendered.includes(secret));
};

test("credential-shaped keys are redacted whatever their casing or separator", () => {
	const keys = [
		"jwt",
		"idJwt",
		"session",
		"sessionId",
		"session_id",
		"bearer",
		"bearerToken",
		"signature",
		"webhookSignature",
		"pan",
		"cardNumber",
		"card_number",
	];
	const redacted = redact(Object.fromEntries(keys.map((key) => [key, `${key}-plaintext`])));
	expect(redacted).toEqual(Object.fromEntries(keys.map((key) => [key, "<redacted>"])));
	expect(redact({ panel: "visible", sessions: 3 })).toEqual({ panel: "visible", sessions: 3 });
});

test("anti-forgery, one-time code, access key and bank account names are redacted by word", () => {
	const keys = [
		"csrf",
		"csrfToken",
		"xsrf",
		"x-xsrf",
		"otpCode",
		"OTPCode",
		"pinCode",
		"userPin",
		"accessKeyId",
		"access_key_id",
		"iban",
		"payoutIban",
		"accountNumber",
	];
	const redacted = redact(Object.fromEntries(keys.map((key) => [key, `${key}-plaintext`])));
	expect(redacted).toEqual(Object.fromEntries(keys.map((key) => [key, "<redacted>"])));
	const visible = { accountName: "c", options: 1, pinboard: 2, pinned: true, spinner: "a", topic: "b" };
	expect(redact(visible)).toEqual(visible);
});

test("long strings are cut with a marker counting the dropped characters", () => {
	expect(redact({ note: `${"a".repeat(2048)}${"b".repeat(952)}` })).toEqual({ note: `${"a".repeat(2048)}…<952 more chars>` });
	expect(redact("short")).toBe("short");
});

test("credential-shaped text inside strings is masked", () => {
	const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1In0.c2lnbmF0dXJlLXBsYWludGV4dA";
	const redacted = redact({
		detail: "retry with password=hunter2-plaintext&user=alice, token: tok-plaintext",
		message: `upstream rejected Authorization: Bearer abc.def-plaintext and ${jwt}`,
		stack: "Error: connect postgres://app:db-plaintext@db.internal:5432/app failed\n    at connect (file:///srv/token.ts:1:2)",
	});
	expect(leaks(redacted, ["abc.def-plaintext", "c2lnbmF0dXJl", "db-plaintext", "hunter2-plaintext", "tok-plaintext"])).toEqual([]);
	expect(redacted).toEqual({
		detail: "retry with password=<redacted>&user=alice, token: <redacted>",
		message: "upstream rejected Authorization: <redacted> <redacted> and <redacted>",
		stack: "Error: connect postgres://app:<redacted>@db.internal:5432/app failed\n    at connect (file:///srv/token.ts:1:2)",
	});
});

test("large collections and binary data are summarised instead of walked", () => {
	const redacted = redact({
		buffer: new ArrayBuffer(16),
		items: Array.from({ length: 500 }, (_, index) => index),
		upload: new Uint8Array(4096),
		wide: Object.fromEntries(Array.from({ length: 500 }, (_, index) => [`k${index}`, index])),
	});
	expect(redacted).toMatchObject({ buffer: "<ArrayBuffer 16 bytes>", upload: "<Uint8Array 4096 bytes>" });
	expect(inspect(redacted, { depth: 5, maxArrayLength: null }).length).toBeLessThan(3000);
	expect(redacted).toMatchObject({ items: expect.arrayContaining(["<450 more items>"]) });
	expect(redacted).toMatchObject({ wide: expect.objectContaining({ "<truncated>": "450 more keys" }) });
});

class LeakyDefect extends Error {
	readonly apiKey = "key-plaintext";
}

const Crashes = RpcGroup.make(Rpc.make("Crash", { payload: { kind: Schema.String }, success: Schema.Void })).middleware(RequestTracing);

const Handlers = Crashes.toLayer({
	Crash: ({ kind }) =>
		kind === "object"
			? Effect.die({ detail: "object defect", password: "hunter2-plaintext" })
			: Effect.die(new LeakyDefect("leaky defect", { cause: { reason: "nested", token: "token-plaintext" } })),
});

test("defect logs keep the error's shape but redact its fields and cause", async () => {
	const recorded = recorder();
	await Effect.runPromise(
		Effect.gen(function* () {
			const client = yield* RpcTest.makeClient(Crashes);
			yield* Effect.exit(client.Crash({ kind: "object" }));
			yield* Effect.exit(client.Crash({ kind: "error" }));
		}).pipe(Effect.provide(Layer.mergeAll(Handlers, requestTracingLayer(), recorded.layer)), Effect.scoped),
	);
	const defects = recorded.logs.filter((log) => log.level === "Error");
	expect(defects).toHaveLength(2);
	expect(leaks(defects, ["hunter2-plaintext", "key-plaintext", "token-plaintext"])).toEqual([]);
	expect(defects.map((log) => log.annotations["rpc.defect"])).toEqual([
		[{ detail: "object defect", password: "<redacted>" }],
		[expect.objectContaining({ apiKey: "<redacted>", cause: { reason: "nested", token: "<redacted>" }, message: "leaky defect", name: "Error" })],
	]);
});

test("provider failures are logged without credential fields", async () => {
	const recorded = recorder();
	const failing = betterAuthSessions(() => Promise.reject(Object.assign(new Error("database closed"), { cookie: "session=cookie-plaintext" })));
	await Effect.runPromise(Effect.exit(failing.get(Headers.empty)).pipe(Effect.provide(recorded.layer)));
	const [failure] = recorded.logs.filter((log) => log.level === "Error");
	expect(inspect(failure?.message, { depth: 20 })).toContain("database closed");
	expect(leaks(recorded.logs, ["cookie-plaintext"])).toEqual([]);
});

test("the cause seen by the client, error reporters and the server span has redacted defects", async () => {
	const recorded = recorder();
	const reported: Array<Cause.Cause<unknown>> = [];
	const reporter = ErrorReporter.make(({ cause }) => {
		reported.push(cause);
	});
	const exits = await Effect.runPromise(
		Effect.gen(function* () {
			const client = yield* RpcTest.makeClient(Crashes);
			return yield* Effect.all([Effect.exit(client.Crash({ kind: "object" })), Effect.exit(client.Crash({ kind: "error" }))]);
		}).pipe(Effect.provide(Layer.mergeAll(Handlers, requestTracingLayer(), recorded.layer, ErrorReporter.layer([reporter]))), Effect.scoped),
	);
	const secrets = ["hunter2-plaintext", "key-plaintext", "token-plaintext"];
	expect(reported).toHaveLength(2);
	expect(leaks(reported, secrets)).toEqual([]);
	expect(leaks(exits, secrets)).toEqual([]);
	const spans = recorded.spans.filter((span) => span.name === "RpcServer.Crash");
	expect(spans).toHaveLength(2);
	expect(
		leaks(
			spans.map((span) => [span.status, span.events, span.attributes]),
			secrets,
		),
	).toEqual([]);
	const [objectExit, errorExit] = exits;
	expect(objectExit !== undefined && Exit.isFailure(objectExit) && Cause.squash(objectExit.cause)).toEqual({
		detail: "object defect",
		password: "<redacted>",
	});
	const defect = errorExit !== undefined && Exit.isFailure(errorExit) ? Cause.squash(errorExit.cause) : undefined;
	expect(defect).toBeInstanceOf(Error);
	expect(defect).toMatchObject({ apiKey: "<redacted>", cause: { reason: "nested", token: "<redacted>" }, message: "leaky defect" });
});

test("a redacting error reporter hands the wrapped reporter a redacted cause with the same reporting hints", async () => {
	const reported: Array<{ readonly error: Error; readonly severity: string; readonly attributes: unknown }> = [];
	const inner = ErrorReporter.make(({ error, severity, attributes }) => {
		reported.push({ attributes, error, severity });
	});
	const defect = Object.assign(new Error("login failed for password=hunter2-plaintext"), {
		[ErrorReporter.severity]: "Error",
		[ErrorReporter.attributes]: { apiKey: "key-plaintext", userId: "u1" },
	});
	await Effect.runPromise(
		Effect.withFiber((fiber) => Effect.sync(() => redactingErrorReporter(inner).report({ cause: Cause.die(defect), fiber, timestamp: 0n }))),
	);
	expect(leaks(reported, ["hunter2-plaintext", "key-plaintext"])).toEqual([]);
	expect(reported).toEqual([
		{
			attributes: { apiKey: "<redacted>", userId: "u1" },
			error: expect.objectContaining({ message: "login failed for password=<redacted>" }),
			severity: "Error",
		},
	]);
});
