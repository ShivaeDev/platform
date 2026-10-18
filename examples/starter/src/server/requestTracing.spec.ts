import { Effect } from "effect";
import { RpcClient } from "effect/rpc";
import { expect } from "vitest";
import { Unauthorized } from "@shivaedev/platform/errors/taxonomy.ts";
import { app, signedIn } from "#test-support/application.ts";

app.it("logs a redacted authentication failure with the RPC request id", [], function* ({ anonymous, logs }) {
	const client = yield* anonymous();
	const failure = yield* client
		.create({ title: "password=hidden-request-password" })
		.pipe(RpcClient.withHeaders({ "x-request-id": "auth-failure-request" }), Effect.flip);
	expect(failure).toBeInstanceOf(Unauthorized);
	expect(logs().filter((entry) => entry.annotations["rpc.method"] !== undefined)).toEqual([
		{
			annotations: {
				requestId: "auth-failure-request",
				"rpc.failure": "Unauthorized",
				"rpc.method": "notes.create",
				"rpc.payload": { title: "password=<redacted>" },
			},
			level: "Info",
			message: ["RPC failure"],
		},
	]);
});

app.it("logs a handler rejection with a generated request id", [signedIn()], function* ({ actor, logs }) {
	const client = actor().notes;
	const note = yield* client.create({ title: "Original" });
	yield* client.update({ ...note, title: "Saved" });
	expect(yield* client.update({ ...note, title: "token=hidden-request-token" }).pipe(Effect.flip)).toMatchObject({ _tag: "Conflict" });
	expect(logs().filter((entry) => entry.annotations["rpc.method"] !== undefined)).toEqual([
		{
			annotations: {
				requestId: expect.stringMatching(/^[a-f0-9]{32}$/u),
				"rpc.failure": "Conflict",
				"rpc.method": "notes.update",
				"rpc.payload": { id: note.id, title: "token=<redacted>", version: note.version },
			},
			level: "Info",
			message: ["RPC failure"],
		},
	]);
});
