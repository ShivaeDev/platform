import { Effect } from "effect";
import { expect } from "vitest";
import { BadRequest } from "@shivaedev/platform/errors/taxonomy.ts";
import { boardStory, deferredServing } from "#test/boardStory.ts";
import { runAgent } from "./agent-cli.ts";

const cases: readonly [readonly string[], string][] = [
	[[], "Usage: work-board question"],
	[["question"], "Usage: work-board question"],
	[["responses"], "Usage: work-board responses --follow"],
	[["responses", "--follow"], "Usage: work-board responses --follow"],
	[["responses", "--follow", ".", "--since"], "Usage: work-board responses --follow"],
	[["responses", "--follow", ".", "--since", "invalid"], "Use --since with an ISO timestamp"],
	[["unknown", "request"], "Usage: work-board question"],
	[["response", "question", "--port"], "each with a value"],
	[["response", "question", "--unknown", "value"], "each with a value"],
	[["response", "question", "--port", "4747", "--port", "4848"], "Supply each option once"],
	[["response", "question", "--port", "0"], "Use an integer from 1 to 65535"],
	[["response", "question", "--port", "65536"], "Use an integer from 1 to 65535"],
	[["response", "question", "--port", "4747", "--url", "http://localhost:4747"], "Choose --url or --port"],
	[["question", "item/request", "--url", "not a URL"], "Use a loopback Work Board URL"],
];
for (const [args, message] of cases) {
	boardStory.it(`delivers command input ${JSON.stringify(args)} as a typed failure with a correction`, [deferredServing], function* () {
		const error = yield* Effect.promise(() => runAgent(args).catch((cause: unknown) => cause));
		expect(error).toBeInstanceOf(BadRequest);
		expect(error).toMatchObject({ message: expect.stringContaining(message) });
	});
}
