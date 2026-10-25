import { existsSync, readdirSync, readFileSync, watch, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { Effect, FileSystem } from "effect";
import { writeJson } from "#package-check/io.ts";
import { consumers } from "#package-check/test-support/consumers.ts";

export const packingGitConsumer = consumers.trait("workspace", "the consumer commit triggers detached Git packing", function* (engine) {
	const fs = yield* FileSystem.FileSystem;
	const source = yield* fs.readFileString(join(process.cwd(), "script/package-check/test-support/gitConsumerBin.ts.txt"));
	yield* fs.writeFileString(join(engine.root, "packages/probe/cli.js"), source);
	yield* writeJson(join(engine.root, "script/package-check/consumer-cases.json"), {});
	engine.fileSystem = {
		...fs,
		makeTempDirectoryScoped: (options) =>
			Effect.gen(function* () {
				const directory = yield* fs.makeTempDirectoryScoped(options);
				yield* Effect.addFinalizer(() => drainGitAtCleanup(directory, engine.writesAtCleanup));
				return directory;
			}),
	};
});

function drainGitAtCleanup(directory: string, writes: string[]) {
	return Effect.promise(async () => {
		if (!existsSync(join(directory, ".git/gc-waiting"))) {
			return;
		}
		// Observe the real packer's writes at the removal boundary, then drain it to keep the fixture scoped.
		const finished = packingFinished(join(directory, "trace.jsonl"));
		writeFileSync(join(directory, "release-git"), "release\n");
		await finished;
		writes.push(...readdirSync(join(directory, ".git/objects/pack")));
	});
}

function packingFinished(trace: string) {
	function events() {
		return readFileSync(trace, "utf8")
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));
	}
	const session = events().find((event) => event.event === "cmd_name" && event.name === "maintenance")?.sid;
	return new Promise<void>((resolve, reject) => {
		const watcher = watch(trace, () => {
			if (
				!events().some((event) => event.event === "region_leave" && event.category === "maintenance" && event.label === "gc" && event.sid === session)
			) {
				return;
			}
			watcher.close();
			clearTimeout(timeout);
			resolve();
		});
		const timeout = setTimeout(() => {
			watcher.close();
			reject(new Error("Git packing did not finish"));
		}, 10_000);
	});
}
