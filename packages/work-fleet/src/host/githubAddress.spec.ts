import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ADOPTED_HEAD } from "#test/githubChecks.ts";
import { githubCliHost } from "#test/githubHostStory.ts";

for (const pr of [
	"https://example.org/example/project/pull/7",
	"https://github.com.example.org/example/project/pull/7",
	"https://github.com/example/project/pull/0",
	"https://github.com/example/project/pull/01",
	"https://github.com/example/project/pull/-1",
	"https://github.com/example/project/pull/1.5",
	"https://github.com/example/project/pull/9007199254740993",
	"https://github.com/example/project",
]) {
	githubCliHost.it(`check observation refuses ${pr} before GitHub access`, [], function* (github) {
		const client = yield* github.cli(new Map());
		const failure = yield* client.checks({ head: ADOPTED_HEAD, kind: "change", paths: ["src/task.ts"], pr }).pipe(Effect.flip);

		expect(failure).toMatchObject({ _tag: "ServiceUnavailable", message: "GitHub checks need a GitHub pull request URL and an exact commit SHA" });
		expect(client.commands).toEqual([]);
	});
}
