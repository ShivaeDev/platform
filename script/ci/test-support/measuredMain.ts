import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Layer, Logger, Option } from "effect";
import { FetchHttpClient } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { GitHub } from "@shivaedev/github/GitHub.ts";
import { GitHubConfig } from "@shivaedev/github/GitHubConfig.ts";
import { GitHubToken } from "@shivaedev/github/GitHubToken.ts";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { planning } from "./planning.ts";

function measuredGithub(args: string[]) {
	if (args[1]?.includes("workflows/ci.yml")) {
		return JSON.stringify({
			"workflow_runs": [43, 42].map((id) => ({ conclusion: "success", event: "push", "head_branch": "main", "head_sha": `sha-${id}`, id })),
		});
	}
	if (args[0] === "api") {
		return JSON.stringify({ artifacts: [{ expired: false, id: args[1]?.includes("/43/") ? 4300 : 4200, name: args[1]?.split("name=")[1] }] });
	}
	const directory = args[args.indexOf("--dir") + 1] ?? "";
	const tests = args.includes("test-balancing");
	const runId = args[2] ?? "";
	mkdirSync(directory, { recursive: true });
	writeFileSync(
		join(directory, tests ? "test-durations.json" : "consumer-durations.json"),
		JSON.stringify({
			runId,
			sha: tests && runId === "43" ? "wrong" : `sha-${runId}`,
			shardCount: tests ? 3 : 5,
			timings: [{ durationMs: 10_000, name: "file" }],
		}),
	);
	return "";
}

export function measuredMain(
	mode: "available" | "denied" | "missing consumers" | "replaced" | "invalid runs" | "invalid artifacts" | "unreadable snapshot" = "available",
) {
	return planning.trait("workspace", `main timings are ${mode}`, function* (engine) {
		let identity = 0;
		engine.github = (args) => {
			if (mode === "unreadable snapshot" && args[0] === "run") {
				throw new Error("download failed");
			}
			if (!args[1]?.includes("/artifacts?")) {
				return measuredGithub(args);
			}
			if (mode === "missing consumers" && args[1].includes("name=consumer-balancing")) {
				return JSON.stringify({ artifacts: [] });
			}
			if (mode === "replaced") {
				identity += 1;
				return JSON.stringify({ artifacts: [{ expired: false, id: identity, name: args[1].split("name=")[1] }] });
			}
			return measuredGithub(args);
		};
		const server = yield* fakeHttpService({
			routes: {
				api: {
					path: "/:path*",
					reply: (request) => {
						if (mode === "denied") {
							return { body: { message: "denied" }, status: HttpStatus.fromLiteral("Unauthorized") };
						}
						if (mode === "invalid runs" && request.path.includes("workflows/ci.yml")) {
							return { body: { "workflow_runs": [{ id: "invalid" }] } };
						}
						if (mode === "invalid artifacts" && request.path.includes("/artifacts")) {
							return { body: { artifacts: [{ id: "invalid" }] } };
						}
						return { body: JSON.parse(engine.github(["api", request.path])) };
					},
				},
			},
		});
		const context = yield* Layer.build(
			GitHub.layer.pipe(
				Layer.provide(
					Layer.mergeAll(FetchHttpClient.layer, Layer.succeed(GitHubToken)(Option.none()), Layer.succeed(GitHubConfig)({ apiUrl: server.url })),
				),
			),
		);
		engine.githubLayer = Layer.mergeAll(Layer.succeedContext(context), Logger.layer([Logger.make(({ message }) => engine.logs.push(message))]));
	});
}
