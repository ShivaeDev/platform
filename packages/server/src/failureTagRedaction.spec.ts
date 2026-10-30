import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { sensitiveFailureTag } from "#test/app-host/sensitiveFailureTag.ts";
import { host } from "#test/app-host/story.ts";

for (const source of ["schema", "host"] as const) {
	host.it(
		`a ${source}-sensitive error tag is masked in the RPC failure log and absent from the client answer, which keeps the public detail`,
		[sensitiveFailureTag(source)],
		function* ({ answerMentions, callRpc, diagnosticLog, logMentions }) {
			yield* callRpc("taggedFailure", { _tag: "private-marker" });

			yield* outcomes({
				"answer text": [answerMentions("public detail", "private-marker"), ["public detail"]],
				"failure log": [
					diagnosticLog("RPC failure"),
					expect.objectContaining({ "rpc.failure": "<redacted>", "rpc.method": "taggedFailure", "rpc.payload": { _tag: "<redacted>" } }),
				],
				"leaked into logs": [logMentions("private-marker"), []],
			});
		},
	);
}
