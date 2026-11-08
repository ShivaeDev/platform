import { relative, resolve } from "node:path";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { Effect, FileSystem, Result } from "effect";
import { BaseSequencer, type TestSpecification } from "vitest/node";
import { balancedShards } from "#ci/shard.ts";
import { durationEstimates, readTimingSnapshot } from "#ci/timings.ts";

export class TestSequencer extends BaseSequencer {
	estimates() {
		const path = resolve(this.ctx.config.root, ".ci/test-balancing/test-durations.json");
		const estimates = Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			return (yield* fs.exists(path)) ? durationEstimates(yield* readTimingSnapshot(path)) : {};
		});
		return Effect.runPromise(estimates.pipe(Effect.provide(NodeFileSystem.layer)));
	}

	name(file: TestSpecification) {
		return `${file.project.name}:${relative(this.ctx.config.root, file.moduleId).replaceAll("\\", "/")}`;
	}

	override async shard(files: TestSpecification[]) {
		const shard = this.ctx.config.shard;
		if (shard === undefined) {
			return files;
		}
		const estimates = await this.estimates();
		const shards = balancedShards(
			files,
			shard.count,
			(file) => this.name(file),
			(file) => estimates[this.name(file)] ?? 1000,
		);
		return Result.getOrThrow(shards)[shard.index - 1] ?? [];
	}

	override async sort(files: TestSpecification[]) {
		const estimates = await this.estimates();
		const ordered = await super.sort(files);
		return ordered.sort(
			(a, b) =>
				a.project.config.sequence.groupOrder - b.project.config.sequence.groupOrder
				|| (estimates[this.name(b)] ?? 1000) - (estimates[this.name(a)] ?? 1000),
		);
	}
}
