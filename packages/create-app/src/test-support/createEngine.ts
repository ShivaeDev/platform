import { cpSync, mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect, FileSystem } from "effect";
import type { appFolder } from "./cli.ts";
import { templateSource } from "./templateSource.ts";

export function* createEngine() {
	const fs = yield* FileSystem.FileSystem;
	const folder = yield* fs.makeTempDirectoryScoped({ prefix: "create-app-story-" });
	const cliFolder = join(folder, "cli");
	yield* Effect.sync(() => {
		mkdirSync(cliFolder);
		cpSync(fileURLToPath(new URL("../", import.meta.url)), join(cliFolder, "src"), {
			filter: (source) => !(source.endsWith("test-support") || /\.(?:test|spec)\.ts$/u.test(source)),
			recursive: true,
		});
		cpSync(fileURLToPath(new URL("../../package.json", import.meta.url)), join(cliFolder, "package.json"));
		symlinkSync(fileURLToPath(new URL("../../node_modules", import.meta.url)), join(cliFolder, "node_modules"));
	});
	const environment: string[] = [
		"GIT_CONFIG_COUNT=2",
		"GIT_CONFIG_KEY_0=maintenance.auto",
		"GIT_CONFIG_VALUE_0=false",
		"GIT_CONFIG_KEY_1=gc.auto",
		"GIT_CONFIG_VALUE_1=0",
	];
	const options: NonNullable<Parameters<typeof appFolder>[1]> = {};
	return {
		cli: join(cliFolder, "src/cli.ts"),
		environment,
		options,
		root: join(folder, "workspace"),
		source: templateSource(cliFolder, { realStarter: true }),
	};
}
