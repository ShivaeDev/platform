import { Effect } from "effect";
import { expect } from "vitest";
import { argumentsFor } from "#arguments.ts";
import { effectApp } from "#test/services.ts";

effectApp("arguments select explicit PRs, defaults and fleet settings", function* () {
	const explicit = yield* argumentsFor(["--repo", "acme/project", "1", "2", "1"], "token");
	expect(explicit).toMatchObject({
		help: false,
		once: false,
		options: {
			apiUrl: "https://api.github.com",
			fleet: false,
			interval: 60_000,
			numbers: [1, 2],
			stateFile: ".pr-watch/acme-project.json",
			token: "token",
		},
	});
	expect(yield* argumentsFor(["--help"], "")).toEqual({ help: true });
	const fleet = yield* argumentsFor(
		["--repo", "acme/project", "--fleet", "--interval", "5", "--once", "--state", "custom.json", "--api-url", "https://github.example/api/v3/"],
		"",
	);
	expect(fleet).toMatchObject({
		once: true,
		options: { apiUrl: "https://github.example/api/v3", fleet: true, interval: 5000, numbers: [], stateFile: "custom.json" },
	});
});
effectApp.each([
	[],
	["--repo", "bad"],
	["--repo", "acme/project"],
	["--repo", "acme/project", "-1"],
	["--repo", "acme/project", "1", "--fleet"],
	["--repo", "acme/project", "1", "--interval", "0"],
	["--repo", "acme/project", "1", "--api-url", "http://github.example"],
	["--repo", "acme/project", "1", "--api-url", "https://user:password@github.example"],
])("invalid arguments fail", function* (args) {
	expect((yield* Effect.result(argumentsFor(args, "")))._tag).toBe("Failure");
});
