import { Effect, FileSystem, Layer, Path } from "effect";
import { loadHost } from "#host/configFile.ts";
import { staticConfig } from "#host/liveConfig.ts";
import { MainSource } from "#host/mainSource.ts";
import { hostPolicy } from "#host/runtime.ts";
import { FleetPolicy } from "#policy.ts";
import { policyGuidance } from "#policyGuidance.ts";
import { reviewerPrompt } from "#prompt/reviewer.ts";
import { withWorkerGuidance } from "#prompt/worker.ts";
import { MAIN } from "#test/mainSource.ts";

export const configuredPrompt = Effect.fn("Guidance.configuredPrompt")(function* (
	role: "worker" | "reviewer",
	guidance?: unknown,
	files: Readonly<Record<string, string>> = {},
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const board = yield* fs.makeTempDirectoryScoped();
	yield* fs.writeFileString(
		path.join(board, "fleet.config.json"),
		JSON.stringify({ provider: "local", worker: { branchPrefix: "test/", [`${role}Guidance`]: guidance, sharedEnvironment: "/synthetic/env.sh" } }),
	);
	for (const [file, text] of Object.entries(files)) {
		yield* fs.writeFileString(path.join(board, file), text);
	}
	const host = yield* loadHost(board);
	const policy = yield* FleetPolicy.pipe(
		Effect.provide(hostPolicy(host).pipe(Layer.provide(staticConfig(host)))),
		Effect.provideService(MainSource, {
			current: Effect.succeed(MAIN),
			latest: Effect.succeed(MAIN),
			observe: () => Effect.die("Guidance does not observe main"),
			refresh: Effect.succeed(MAIN),
			repositoryRoot: board,
		}),
	);
	const text = yield* policyGuidance(policy, role);
	return role === "worker"
		? withWorkerGuidance("Implement this task", text)
		: reviewerPrompt({
				...policy,
				...(text === undefined ? {} : { reviewerGuidance: text }),
				result: { evidence: ["Already implemented"], head: "exact-head", kind: "no-change" },
				task: "Review this task",
			});
});
