import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { BaseSequencer, type TestSpecification } from "vitest/node";
import { balancedShards } from "#ci/shard.ts";
import { decodeTimingSnapshot, durationEstimates } from "#ci/timings.ts";

export class TestSequencer extends BaseSequencer {
	estimates() {
		const path = resolve(this.ctx.config.root, ".ci/test-balancing/test-durations.json");
		return existsSync(path) ? durationEstimates(decodeTimingSnapshot(JSON.parse(readFileSync(path, "utf8")))) : {};
	}

	name(file: TestSpecification) {
		return `${file.project.name}:${relative(this.ctx.config.root, file.moduleId).replaceAll("\\", "/")}`;
	}

	override shard(files: TestSpecification[]) {
		const shard = this.ctx.config.shard;
		if (shard === undefined) {
			return Promise.resolve(files);
		}
		const estimates = this.estimates();
		return Promise.resolve(
			balancedShards(
				files,
				shard.count,
				(file) => this.name(file),
				(file) => estimates[this.name(file)] ?? 1000,
			)[shard.index - 1] ?? [],
		);
	}

	override async sort(files: TestSpecification[]) {
		const estimates = this.estimates();
		const ordered = await super.sort(files);
		return ordered.sort(
			(a, b) =>
				a.project.config.sequence.groupOrder - b.project.config.sequence.groupOrder
				|| (estimates[this.name(b)] ?? 1000) - (estimates[this.name(a)] ?? 1000),
		);
	}
}
