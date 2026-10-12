import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { BadRequest } from "@shivaedev/platform/errors/taxonomy.ts";
import { runAgent } from "./agent-cli.ts";

const cases: readonly [readonly string[], string][] = [
	[[], "Usage: work-board question"],
	[["question"], "Usage: work-board question"],
	[["unknown", "request"], "Usage: work-board question"],
	[["response", "question", "--port"], "each with a value"],
	[["response", "question", "--unknown", "value"], "each with a value"],
	[["response", "question", "--port", "4747", "--port", "4848"], "Supply each option once"],
	[["response", "question", "--port", "0"], "Use an integer from 1 to 65535"],
	[["response", "question", "--port", "65536"], "Use an integer from 1 to 65535"],
	[["response", "question", "--port", "4747", "--url", "http://localhost:4747"], "Choose --url or --port"],
	[["question", "item/request", "--url", "not a URL"], "Use a loopback Work Board URL"],
];
it.live.each(cases)("delivers command input %j as a typed failure with a correction", function* ([args, message]) {
	const error = yield* Effect.promise(() => runAgent(args).catch((cause: unknown) => cause));
	expect(error).toBeInstanceOf(BadRequest);
	expect(error).toMatchObject({ message: expect.stringContaining(message) });
});
