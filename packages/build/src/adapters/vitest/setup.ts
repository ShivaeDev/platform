import { Option } from "effect";
import type { TestProject } from "vitest/node";
import { runNode } from "#adapters/runNode.ts";
import { generateRound } from "#generateRound.ts";

// A Vitest global setup: every module's files are written before the first test file loads, and a refusal stops the run.
export async function setup(project: TestProject): Promise<void> {
	const round = await runNode(generateRound(project.config.root));
	if (Option.isSome(round.refusal)) {
		throw new Error(round.refusal.value);
	}
}
