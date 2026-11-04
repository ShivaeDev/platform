import { Result } from "effect";
import { expect, it } from "vitest";
import { type Input, optionsFor } from "#arguments.ts";

const input: Input = {
	apiUrl: "https://api.github.com",
	fleet: false,
	heartbeat: 900,
	interval: 60,
	numbers: [1],
	once: false,
	repository: "acme/project",
};

it("watch settings deduplicate PRs and convert seconds to milliseconds", () => {
	const parsed = Result.getOrThrow(optionsFor({ ...input, numbers: [1, 2, 1] }));
	expect(parsed).toMatchObject({ heartbeat: 900_000, options: { interval: 60_000, numbers: [1, 2], stateFile: ".pr-watch/acme-project.json" } });
});

it.each<Partial<Input>>([
	{ repository: "bad" },
	{ numbers: [] },
	{ numbers: [-1] },
	{ numbers: [Number.MAX_SAFE_INTEGER + 1] },
	{ fleet: true },
	{ interval: 0 },
	{ heartbeat: -1 },
	{ apiUrl: "not a URL" },
	{ apiUrl: "http://github.example" },
	{ apiUrl: "https://user:password@github.example" },
])("invalid watch settings fail as argument errors", (changes) => {
	const error = Result.getOrThrow(Result.flip(optionsFor({ ...input, ...changes })));
	expect(error.reason).toBe("arguments");
});
