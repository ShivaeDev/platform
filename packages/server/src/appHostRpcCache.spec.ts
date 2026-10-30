import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminApplication, adminRole } from "#test/app-host/admin.ts";
import { configuration, host } from "#test/app-host/story.ts";

host.it(
	"a signed-out batch mixing a public answer with an admin refusal is uncacheable and runs no admin handler",
	[adminApplication, adminRole("admin")],
	function* ({ adminRpc, handledCalls, responseCacheControl, rpcAnswers }) {
		yield* adminRpc(["publicRead", "adminRead"], "signed-out caller");

		yield* outcomes({
			"answers": [rpcAnswers(), { adminRead: "failed with unauthorized", publicRead: "public result" }],
			"cache control": [responseCacheControl(), "private, no-store"],
			"handled calls": [handledCalls(), []],
		});
	},
);

host.it(
	"an admin handler's typed failure reaches the member as conflict in an uncacheable response",
	[adminApplication, adminRole("admin")],
	function* ({ adminRpc }) {
		expect(yield* adminRpc(["adminReject"], "member")).toEqual({
			answers: { adminReject: "failed with conflict" },
			cacheControl: "private, no-store",
			status: HttpStatus.fromLiteral("OK"),
		});
	},
);

host.it(
	"an open admin RPC stream delivers its first chunk in an uncacheable response",
	[adminApplication, adminRole("admin")],
	function* ({ openAdminStream }) {
		expect(yield* openAdminStream()).toEqual({
			cacheControl: "private, no-store",
			firstChunk: "streamed member@example.test",
			status: HttpStatus.fromLiteral("OK"),
		});
	},
);

for (const { name, body, contentType, status } of [
	{ body: "{invalid json}\n", contentType: "application/ndjson", name: "malformed NDJSON", status: HttpStatus.fromLiteral("OK") },
	{ body: "{}\n", contentType: "application/json", name: "a JSON content type", status: HttpStatus.fromLiteral("Forbidden") },
	{ body: "x".repeat(257), contentType: "application/ndjson", name: "a body over the 256-byte limit", status: HttpStatus.fromLiteral("BadRequest") },
]) {
	host.it(
		`an RPC post with ${name} answers ${status} uncacheably without running a handler`,
		[adminApplication, configuration({ maxBodySize: 256 })],
		function* ({ handledCalls, rawRpc, responseCacheControl, responseStatus }) {
			yield* rawRpc(body, contentType);

			yield* outcomes({
				"cache control": [responseCacheControl(), "private, no-store"],
				"handled calls": [handledCalls(), []],
				"status": [responseStatus(), status],
			});
		},
	);
}
