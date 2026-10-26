import { Effect } from "effect";
import { expect } from "vitest";
import { BadRequest } from "@shivaedev/errors/taxonomy.ts";
import { it } from "@shivaedev/test/it.ts";
import { agentArguments, agentUrl } from "./agentArguments.ts";

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
];
for (const [args, message] of cases) {
	it.effect(`delivers command input ${JSON.stringify(args)} as a typed failure with a correction`, function* () {
		const error = yield* Effect.flip(agentArguments(args));
		expect(error).toBeInstanceOf(BadRequest);
		expect(error).toMatchObject({ message: expect.stringContaining(message) });
	});
}

it.effect("rejects unsafe agent server URLs through the typed error channel before creating any HTTP request", function* () {
	for (const url of [
		"not a URL",
		"https://127.0.0.1:4747",
		"http://remote.example",
		"http://user:pass@localhost:4747",
		"http://localhost:4747/path",
		"http://localhost:4747/?q=1",
		"http://localhost:4747/#fragment",
	]) {
		expect(yield* Effect.flip(agentUrl(url))).toMatchObject({
			_tag: "BadRequest",
			message: "Use a loopback Work Board URL, such as http://127.0.0.1:4747.",
		});
	}
});
