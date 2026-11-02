import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { github } from "#test/github.ts";
import { githubAnswers } from "#test/repositoryReadTraits.ts";

for (const arrayKey of [undefined, "check_runs", "artifacts"]) {
	function page(items: unknown[]) {
		return arrayKey === undefined ? items : { [arrayKey]: items, "total_count": 4 };
	}
	const twoPages = [
		githubAnswers("/paged", { body: page([{ title: "First" }, { title: "Second" }]), headers: { Link: '</paged?page=2>; rel="next"' } }),
		githubAnswers("/paged?page=2", { body: page([{ title: "Third" }, { title: "Fourth" }]) }),
	];
	const malformedPages = [
		githubAnswers("/paged", { body: page([{ title: "First" }, { title: 2 }]), headers: { Link: '</paged?page=2>; rel="next"' } }),
		githubAnswers("/paged?page=2", { body: page([null, { title: "Fourth" }]), headers: { Link: '</paged?page=3>; rel="next"' } }),
		githubAnswers("/paged?page=3", { body: page([{ title: "Fifth" }]) }),
	];
	const shape = arrayKey ?? "top-level array";

	github.it(`a ${shape} list decodes both pages using the Schema's required service`, twoPages, function* ({ streamPaged }) {
		expect(yield* streamPaged({ arrayKey })).toEqual([
			{ title: "Decoded: First" },
			{ title: "Decoded: Second" },
			{ title: "Decoded: Third" },
			{ title: "Decoded: Fourth" },
		]);
	});
	github.it(`taking one ${shape} item requests only the first page`, twoPages, function* ({ requests, streamPaged }) {
		yield* streamPaged({ arrayKey }, 1);

		expect(yield* requests()).toEqual(["GET /paged 200"]);
	});
	github.it(`a ${shape} list retains pacing before both page requests`, twoPages, function* ({ collectPaged, pagedPacingCalls }) {
		yield* collectPaged({ arrayKey });

		expect(yield* pagedPacingCalls()).toEqual(["core", "core"]);
	});
	github.it(`a pacing refusal stops a ${shape} list before requesting its second page`, twoPages, function* ({ collectPaged, requests }) {
		const result = yield* collectPaged({ arrayKey }, 10, 2);

		yield* outcomes([
			["refusal", () => Effect.succeed(result), "unavailable: pacing budget spent"],
			["requests", () => requests(), ["GET /paged 200"]],
		]);
	});
	github.it(`a bounded ${shape} list skips and counts bad items within the fetched prefix`, malformedPages, function* ({ collectPaged, requests }) {
		const result = yield* collectPaged({ arrayKey, onDecodeError: "skip" }, 2);

		yield* outcomes([
			[
				"decoded prefix",
				() => Effect.succeed(result),
				{ items: [{ title: "Decoded: First" }, { title: "Decoded: Fourth" }], skipped: 2, truncated: true },
			],
			["requests", () => requests(), ["GET /paged 200", "GET /paged?page=2 200"]],
		]);
	});
	github.it(`a ${shape} list fails at its first bad item by default`, malformedPages, function* ({ collectPaged, requests }) {
		const result = yield* collectPaged({ arrayKey });

		yield* outcomes([
			["refusal", () => Effect.succeed(result), "Schema mismatch"],
			["requests", () => requests(), ["GET /paged 200"]],
		]);
	});
	github.it(`a ${shape} page stream reports skipped counts separately for each page`, malformedPages, function* ({ streamPages }) {
		expect(yield* streamPages({ arrayKey, onDecodeError: "skip" })).toEqual([
			{ hasNext: true, items: [{ title: "Decoded: First" }], skipped: 1 },
			{ hasNext: true, items: [{ title: "Decoded: Fourth" }], skipped: 1 },
			{ hasNext: false, items: [{ title: "Decoded: Fifth" }], skipped: 0 },
		]);
	});
	github.it(`a ${shape} list enforces its per-page byte cap even when skipping items`, twoPages, function* ({ collectPaged }) {
		expect(yield* collectPaged({ arrayKey, onDecodeError: "skip", responseByteLimit: 8 })).toBe("body over 8 bytes");
	});
}

for (const [description, reply] of [
	["missing envelope key", { body: { "total_count": 1 } }],
	["envelope key that is not an array", { body: { "check_runs": { title: "First" } } }],
	["malformed JSON", { chunks: ['{"check_runs": ['] }],
] as const) {
	github.it(`skip mode still rejects a ${description}`, [githubAnswers("/paged", reply)], function* ({ collectPaged }) {
		expect(yield* collectPaged({ arrayKey: "check_runs", onDecodeError: "skip" })).toBe("Schema mismatch");
	});
}

github.it(
	"an entirely undecodable page still follows its next Link and counts every skipped item",
	[
		githubAnswers("/paged", { body: [null, { title: 2 }], headers: { Link: '</paged?page=2>; rel="next"' } }),
		githubAnswers("/paged?page=2", { body: [{ title: "Last" }] }),
	],
	function* ({ collectPaged }) {
		expect(yield* collectPaged({ onDecodeError: "skip" })).toEqual({ items: [{ title: "Decoded: Last" }], skipped: 2, truncated: false });
	},
);

github.it(
	"an empty envelope still follows its next Link",
	[
		githubAnswers("/paged", { body: { artifacts: [] }, headers: { Link: '</paged?page=2>; rel="next"' } }),
		githubAnswers("/paged?page=2", { body: { artifacts: [{ title: "Last" }] } }),
	],
	function* ({ collectPaged }) {
		expect(yield* collectPaged({ arrayKey: "artifacts" })).toEqual({ items: [{ title: "Decoded: Last" }], skipped: 0, truncated: false });
	},
);

github.it(
	"an oversized later envelope fails the list even in skip mode",
	[
		githubAnswers("/paged", { body: { artifacts: [] }, headers: { Link: '</paged?page=2>; rel="next"' } }),
		githubAnswers("/paged?page=2", { body: { artifacts: [{ title: "x".repeat(100) }] } }),
	],
	function* ({ collectPaged }) {
		expect(yield* collectPaged({ arrayKey: "artifacts", onDecodeError: "skip", responseByteLimit: 50 })).toBe("body over 50 bytes");
	},
);
