import { spawnSync } from "node:child_process";
import process from "node:process";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

const LIMIT_MB = 16;

// The program keeps everything it allocates, so it reaches the limit within milliseconds.
const PROGRAM = `
import { runWithHeapLimit } from ${JSON.stringify(new URL("../adapters/runWithHeapLimit.ts", import.meta.url).href)};
runWithHeapLimit(${LIMIT_MB}, async () => {
	const kept = [];
	for (;;) kept.push(new Array(10_000).fill(kept.length));
});
`;

interface HeapLimitEngine {
	run: { readonly status: number | null; readonly stderr: string } | undefined;
}

function ran(engine: HeapLimitEngine) {
	if (engine.run === undefined) {
		throw new Error("Run the program before reading its outcome");
	}
	return engine.run;
}

export const heapLimitRun = storyKit({
	create: () => Effect.succeed<HeapLimitEngine>({ run: undefined }),
	inspect: (engine) => ({ status: engine.run?.status }),
	name: "Quality heap limit",
	stages: [],
	verbs: (engine, story) => ({
		exitCode: () => Effect.sync(() => ran(engine).status),
		lastError: () => Effect.sync(() => ran(engine).stderr.trimEnd().split("\n").at(-1)),
		outgrowsLimit: () =>
			Effect.sync(() => {
				story.tell(`a program started under a heap limit of ${LIMIT_MB} MB keeps allocating until Node aborts it`);
				const result = spawnSync(process.execPath, ["--input-type=module", "--eval", PROGRAM], { encoding: "utf8" });
				engine.run = { status: result.status, stderr: result.stderr };
			}),
	}),
});
