import { fileURLToPath } from "node:url";
import { Effect, FileSystem } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { githubChecks } from "#host/githubChecks.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { httpGithubApi, syntheticGithub, unslurped } from "#test/githubApi.ts";
import { ADOPTED_HEAD, checkRun, githubFixture, githubResult } from "#test/githubChecks.ts";

type LogAccess = "readable" | "partial" | "unreadable" | "empty";

function readableLog(access: LogAccess, name: string) {
	return access === "readable" || (access === "partial" && name === "verify");
}

export function recordedCiFailures(access: LogAccess = "readable") {
	return engineConfiguration(`required CI jobs fail with ${access} recorded Vitest logs`, () =>
		Effect.gen(function* () {
			const fixture = githubFixture();
			fixture.required(["verify", "browser"]);
			function job(name: string, id: number, completedAt: string) {
				return checkRun({
					completedAt,
					conclusion: "failure",
					detailsUrl: null,
					htmlUrl: `https://github.com/example/project/actions/runs/10/job/${id}`,
					name,
				});
			}
			fixture.reply(ADOPTED_HEAD, [
				[
					job("verify", 100, "2026-10-30T12:00:00Z"),
					job("verify", 101, "2026-10-31T12:00:00Z"),
					job("browser", 102, "2026-10-31T12:00:00Z"),
					job("optional", 103, "2026-10-31T12:00:00Z"),
				],
			]);
			const github = syntheticGithub();
			for (const [endpoint, body] of unslurped(fixture.responses)) {
				github.reply(endpoint, body);
			}
			const fs = yield* FileSystem.FileSystem;
			const recorded = yield* fs.readFileString(fileURLToPath(new URL("./fixtures/ci-vitest.txt", import.meta.url)));
			const colored = recorded.replaceAll("FAIL", "\u001b[31mFAIL\u001b[0m");
			for (const [name, id] of [
				["browser", 102],
				["verify", 101],
			] as const) {
				const readable = readableLog(access, name);
				github.reply(
					`repos/example/project/actions/jobs/${id}/logs`,
					readable ? (colored + colored).replaceAll("failing.spec.ts", `${name}.spec.ts`) : "",
					{ status: readable || access === "empty" ? HttpStatus.fromLiteral("OK") : HttpStatus.fromLiteral("NotFound") },
				);
			}
			const server = yield* github.serve;
			const api = yield* httpGithubApi(server.url);
			return { checksQuery: githubChecks(api), resultQuery: () => Effect.succeed(githubResult()) };
		}),
	);
}
