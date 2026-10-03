import { Effect, Layer, Option, Redacted, Schema } from "effect";
import { Rpc, type RpcClient, RpcGroup, RpcTest } from "effect/unstable/rpc";
import { expect, test } from "vitest";
import { Conflict, rejectedField } from "../src/errors.ts";
import { RequestId, RequestTracing } from "../src/rpc.ts";
import { isSensitiveKey, type RequestTracingOptions, requestTracingLayer } from "../src/rpc-server.ts";
import { annotationsOf, recorder } from "./rpc/support.ts";

const Registration = Schema.Struct({
	devices: Schema.Array(Schema.Struct({ name: Schema.String, refreshToken: Schema.String })),
	email: Schema.String,
	note: Schema.Redacted(Schema.String),
	password: Schema.String,
	profile: Schema.Struct({ apiKey: Schema.String, nickname: Schema.String }),
});

const Accounts = RpcGroup.make(
	Rpc.make("Echo", { success: Schema.String }),
	Rpc.make("Register", { error: Conflict, payload: Registration, success: Schema.Void }),
	Rpc.make("Crash", { payload: Registration, success: Schema.Void }),
).middleware(RequestTracing);

const Handlers = Accounts.toLayer({
	Crash: () => Effect.die(new Error("boom")),
	Echo: () => Effect.andThen(Effect.logInfo("echo"), RequestId),
	Register: () => Effect.fail(new Conflict({ field: "email", message: "Email already registered" })),
});

const registration = {
	devices: [{ name: "phone", refreshToken: "refresh-plaintext" }],
	email: "alice@example.test",
	note: Redacted.make("note-plaintext"),
	password: "hunter2-plaintext",
	profile: { apiKey: "key-plaintext", nickname: "alice" },
};

const run = async <A, E>(options: RequestTracingOptions, program: (client: RpcClient.FromGroup<typeof Accounts>) => Effect.Effect<A, E>) => {
	const recorded = recorder();
	const value = await Effect.runPromise(
		Effect.gen(function* () {
			const client = yield* RpcTest.makeClient(Accounts);
			return yield* program(client);
		}).pipe(Effect.provide(Layer.mergeAll(Handlers, requestTracingLayer(options), recorded.layer)), Effect.scoped),
	);
	return { value, ...recorded };
};

test("a caller's request id reaches handlers, log annotations and the RPC server span", async () => {
	const { value, logs, spans } = await run({}, (client) => client.Echo(undefined, { headers: { "x-request-id": "trace-7f3a" } }));
	expect(value).toBe("trace-7f3a");
	expect(annotationsOf(logs, "echo")).toEqual([{ requestId: "trace-7f3a", "rpc.method": "Echo" }]);
	const span = spans.find((candidate) => candidate.name === "RpcServer.Echo");
	expect(Object.fromEntries(span?.attributes ?? [])).toMatchObject({ "request.id": "trace-7f3a", "rpc.method": "Echo" });
});

test("missing or malformed request ids are replaced with generated ones", async () => {
	const { value } = await run({ header: "x-correlation-id" }, (client) =>
		Effect.all([
			client.Echo(),
			client.Echo(undefined, { headers: { "x-correlation-id": "has spaces\nand newline" } }),
			client.Echo(undefined, { headers: { "x-correlation-id": "x".repeat(129) } }),
			client.Echo(undefined, { headers: { "x-correlation-id": "accepted-id" } }),
		]),
	);
	expect(value.slice(0, 3).every((id) => /^[0-9a-f]{32}$/u.test(id))).toBe(true);
	expect(new Set(value.slice(0, 3)).size).toBe(3);
	expect(value[3]).toBe("accepted-id");
});

test("failure logs carry a redacted payload while the declared field rejection reaches the caller", async () => {
	const { value, logs } = await run({}, (client) =>
		Effect.all([Effect.flip(client.Register(registration)), Effect.exit(client.Crash(registration))], { concurrency: 1 }),
	);
	const [rejection] = value;
	expect(rejection).toBeInstanceOf(Conflict);
	expect(rejectedField(rejection)).toEqual(Option.some({ field: "email", message: "Email already registered" }));

	const [failure] = annotationsOf(logs, "RPC failure");
	expect(failure).toMatchObject({ "rpc.failure": "Conflict", "rpc.method": "Register" });
	expect(failure?.["rpc.payload"]).toEqual({
		devices: [{ name: "phone", refreshToken: "<redacted>" }],
		email: "alice@example.test",
		note: "<redacted>",
		password: "<redacted>",
		profile: { apiKey: "<redacted>", nickname: "alice" },
	});
	const defect = logs.find((log) => log.level === "Error");
	expect(defect?.annotations).toMatchObject({ "rpc.method": "Crash", "rpc.payload": failure?.["rpc.payload"] });
	const serialized = JSON.stringify(logs.map((log) => log.annotations));
	for (const secret of ["hunter2", "key-plaintext", "refresh-plaintext", "note-plaintext"]) expect(serialized).not.toContain(secret);
});

test("applications extend the sensitive-key policy", async () => {
	const { logs } = await run({ sensitive: (key) => isSensitiveKey(key) || key === "email" }, (client) => Effect.flip(client.Register(registration)));
	expect(annotationsOf(logs, "RPC failure")[0]?.["rpc.payload"]).toMatchObject({ email: "<redacted>", password: "<redacted>" });
	expect(annotationsOf(logs, "echo")).toEqual([]);
});
