import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { loadHost } from "#host/config.ts";
import { hostPolicy } from "#host/runtime.ts";
import { FleetPolicy } from "#policy.ts";
import { reviewerPrompt } from "#prompt/reviewer.ts";

const configuredPrompt = Effect.fn("ReviewerGuidance.configuredPrompt")(function* (
	guidance?: string | { readonly file: string },
	files: Readonly<Record<string, string>> = {},
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const board = yield* fs.makeTempDirectoryScoped();
	yield* fs.writeFileString(
		path.join(board, "fleet.config.json"),
		JSON.stringify({ provider: "local", worker: { branchPrefix: "test/", reviewerGuidance: guidance, sharedEnvironment: "/synthetic/env.sh" } }),
	);
	for (const [file, text] of Object.entries(files)) {
		yield* fs.writeFileString(path.join(board, file), text);
	}
	const host = yield* loadHost(board);
	const policy = yield* FleetPolicy.pipe(Effect.provide(hostPolicy(host)));
	return reviewerPrompt({
		...policy,
		result: { evidence: ["Already implemented"], head: "exact-head", kind: "no-change" },
		task: "Review this task",
	});
});

describe("host reviewer guidance", () => {
	it.effect("passes inline repository guidance from configuration to the reviewer prompt", () =>
		Effect.gen(function* () {
			const guidance = "Inspect the synthetic workflow.\nConfirm database tests are enabled.";
			expect(yield* configuredPrompt(guidance)).toContain(guidance);
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);
	it.effect("reads a guidance file relative to the Board folder", () =>
		Effect.gen(function* () {
			const guidance = "Confirm the synthetic integration checks passed.";
			expect(yield* configuredPrompt({ file: "reviewer.md" }, { "reviewer.md": guidance })).toContain(guidance);
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);
	it.effect("omitted guidance leaves the reviewer prompt repository-independent", () =>
		Effect.gen(function* () {
			const prompt = yield* configuredPrompt();
			expect(prompt).not.toContain("Repository reviewer guidance:");
			expect(prompt).not.toContain("pnpm db:setup");
			expect(prompt).not.toContain("PLATFORM_EFFECT_");
			expect(prompt).not.toContain("script/lib/postgres-test-environment.ts");
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);
	it.effect("an unreadable guidance file fails host policy creation", () =>
		Effect.gen(function* () {
			const failure = yield* configuredPrompt({ file: "missing.md" }).pipe(Effect.flip);
			expect(failure).toMatchObject({ _tag: "HostFailure" });
			expect(failure.message).toMatch(/^Fleet reviewer guidance is missing or unreadable: .*missing\.md$/u);
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);
});
