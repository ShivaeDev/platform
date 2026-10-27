import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { watch } from "#test/watch.ts";

watch.it("CLI prints a failed round and polling stop as JSON alongside successful transitions", [], function* (h) {
	yield* h.poll;
	h.merged(1);
	h.reply("/pulls/2", { body: {}, status: HttpStatus.fromLiteral("InternalServerError") });
	const result = yield* h.cliRun("1", "2", "--once");
	expect(result.code).toBe(1);
	expect(result.stderr).toContain("GitHub HTTP 500");
	expect(
		result.stdout
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line)),
	).toEqual([
		{ branch: "feature-1", event: "merged", number: 1, title: "Change 1" },
		expect.objectContaining({ event: "error", message: "GitHub HTTP 500 (GET /repos/acme/project/pulls/2)" }),
		expect.objectContaining({ event: "stopped" }),
	]);
});
