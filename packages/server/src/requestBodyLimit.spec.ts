import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boundedBody } from "#test/app-host/body.ts";
import { host } from "#test/app-host/story.ts";

const binary = Buffer.from([0, 255, 195, 169, 128, 13, 10]);

host.it("a chunked body over eight bytes is answered 413 before the route handles it", [boundedBody], function* ({ handledCalls, postBytes }) {
	const answer = yield* postBytes([Buffer.alloc(4), Buffer.alloc(5)], { finishAfterResponse: true });

	yield* outcomes({
		"handled bodies": [handledCalls(), []],
		"status": [Effect.succeed(answer.status), HttpStatus.fromLiteral("PayloadTooLarge")],
	});
});

host.it(
	"after a chunked overflow, the same keep-alive connection carries a seven-byte binary body to the route unchanged",
	[boundedBody],
	function* ({ handledCalls, postBytes }) {
		yield* postBytes([Buffer.alloc(4), Buffer.alloc(5)], { finishAfterResponse: true });

		const answer = yield* postBytes([binary.subarray(0, 3), binary.subarray(3)]);

		yield* outcomes({
			"answer": [Effect.succeed(answer), { body: binary, reusedSocket: true, status: HttpStatus.fromLiteral("OK") }],
			"handled bodies": [handledCalls(), [binary]],
		});
	},
);

host.it(
	"a declared content length over eight bytes is answered 413 before the client sends the body",
	[boundedBody],
	function* ({ handledCalls, postBytes }) {
		const answer = yield* postBytes([], { contentLength: 9 });

		yield* outcomes({
			"handled bodies": [handledCalls(), []],
			"status": [Effect.succeed(answer.status), HttpStatus.fromLiteral("PayloadTooLarge")],
		});
	},
);
