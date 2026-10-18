import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { resolveHost } from "#host/config.ts";
import { loadHost } from "#host/configFile.ts";
import { hostGuidance } from "#host/guidance.ts";
import { staticConfig } from "#host/liveConfig.ts";
import { MainSource } from "#host/mainSource.ts";
import { hostPolicy } from "#host/runtime.ts";
import { FleetPolicy } from "#policy.ts";
import { policyGuidance } from "#policyGuidance.ts";
import { reviewerPrompt } from "#prompt/reviewer.ts";
import { withWorkerGuidance } from "#prompt/worker.ts";
import { MAIN } from "#test/mainSource.ts";

const configuredPrompt = Effect.fn("Guidance.configuredPrompt")(function* (
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

for (const role of ["worker", "reviewer"] as const) {
	describe(`host ${role} guidance`, () => {
		it.effect("caches text by modification time and rejects a removed file", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const board = yield* fs.makeTempDirectoryScoped();
				const file = path.join(board, "guidance.txt");
				yield* fs.writeFileString(file, "Original approval.");
				yield* fs.utimes(file, new Date(1000), new Date(1000));
				const host = resolveHost(board, {
					provider: "local",
					worker: { branchPrefix: "test/", sharedEnvironment: "/synthetic/env.sh", [`${role}Guidance`]: { file: "guidance.txt" } },
				});
				const read = yield* hostGuidance(host, role);
				expect(yield* read).toBe("Original approval.");
				yield* fs.writeFileString(file, "Updated approval.");
				yield* fs.utimes(file, new Date(1000), new Date(1000));
				expect(yield* read).toBe("Original approval.");
				yield* fs.utimes(file, new Date(2000), new Date(2000));
				expect(yield* read).toBe("Updated approval.");
				yield* fs.remove(file);
				expect(yield* read.pipe(Effect.flip)).toMatchObject({ _tag: "HostFailure" });
			}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
		);
		for (const guidance of ["", { file: "" }, 17, { file: 3 }]) {
			it.effect(`rejects invalid guidance: ${JSON.stringify(guidance)}`, () =>
				Effect.gen(function* () {
					const failure = yield* configuredPrompt(role, guidance).pipe(Effect.flip);
					expect(failure).toMatchObject({ _tag: "HostFailure" });
					expect(failure.message).toContain("is invalid:");
				}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
			);
		}
		it.effect(`passes inline repository guidance from configuration to the ${role} prompt`, () =>
			Effect.gen(function* () {
				const guidance = "Inspect the synthetic workflow.\nConfirm database tests are enabled.";
				expect(yield* configuredPrompt(role, guidance)).toContain(guidance);
			}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
		);
		it.effect("reads a guidance file relative to the Board folder", () =>
			Effect.gen(function* () {
				const guidance = "Confirm the synthetic integration checks passed.";
				expect(yield* configuredPrompt(role, { file: `${role}.md` }, { [`${role}.md`]: guidance })).toContain(guidance);
			}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
		);
		it.effect(`omitted guidance leaves the ${role} prompt repository-independent`, () =>
			Effect.gen(function* () {
				const prompt = yield* configuredPrompt(role);
				expect(prompt).not.toContain(`Repository ${role} guidance:`);
				expect(prompt).not.toContain("pnpm db:setup");
				expect(prompt).not.toContain("PLATFORM_EFFECT_");
				expect(prompt).not.toContain("script/lib/postgres-test-environment.ts");
			}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
		);
		it.effect("an unreadable guidance file fails host policy creation", () =>
			Effect.gen(function* () {
				const failure = yield* configuredPrompt(role, { file: "missing.md" }).pipe(Effect.flip);
				expect(failure).toMatchObject({ _tag: "HostFailure" });
				expect(failure.message).toContain(`Fleet ${role} guidance is missing or unreadable: `);
				expect(failure.message).toMatch(/missing\.md$/u);
			}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
		);
	});
}
