import { RpcClient } from "effect/rpc";
import { expect } from "vitest";
import { app, signedIn } from "#test-support/application.ts";

app.it("logs a redacted authentication failure with the RPC request id", [], function* ({ anonymous, rejectsWith, logs }) {
	const client = yield* anonymous();
	yield* client
		.create({ title: "password=hidden-request-password" })
		.pipe(RpcClient.withHeaders({ "x-request-id": "auth-failure-request" }), rejectsWith("Unauthorized"));
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

app.it("logs a handler rejection with a generated request id", [signedIn()], function* ({ actor, rejectsWith, logs }) {
	const client = actor().notes;
	const note = yield* client.create({ title: "Original" });
	yield* client.update({ ...note, title: "Saved" });
	yield* client.update({ ...note, title: "token=hidden-request-token" }).pipe(rejectsWith("Conflict"));
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
