import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Config, Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { isolatedGitCommand } from "@shivaedev/test-story/server/adapters/isolatedGit.ts";
import { setupInstaller } from "#test/setupInstaller.ts";
import { hoistedPieces, starterModules } from "#test/starterModules.ts";
import { workspacePnpm } from "#test/tools.ts";

export function appFolder(
	root: string,
	{
		installationExit = 0,
		gitAvailable = true,
		realSetup = false,
		linkedPackageScripts = false,
		installer,
		stubbedQualityExit,
		destination = "absent",
	}: {
		readonly installationExit?: number;
		readonly gitAvailable?: boolean;
		readonly realSetup?: boolean;
		readonly linkedPackageScripts?: boolean;
		readonly installer?: string;
		readonly stubbedQualityExit?: number;
		readonly destination?: "absent" | "empty" | "file" | "nonempty" | "environment";
	} = {},
) {
	mkdirSync(root);
	const bin = join(root, "bin");
	mkdirSync(bin);
	writeFileSync(
		join(bin, "pnpm"),
		`#!/usr/bin/env node\nrequire('node:fs').writeFileSync('installation.json', JSON.stringify(process.argv.slice(2)));\nrequire('node:fs').writeFileSync('pnpm-lock.yaml', 'lockfileVersion: 9.0\\n');\nrequire('node:fs').chmodSync('pnpm-workspace.yaml', 0o600);\nprocess.exit(${installationExit});\n`,
		{ mode: 0o755 },
	);
	if (realSetup || linkedPackageScripts) {
		const pnpm = workspacePnpm();
		const modules = starterModules();
		const quality = fileURLToPath(new URL("../../../quality/src/cli.ts", import.meta.url));
		const skills = fileURLToPath(new URL("../../../skills/src/cli.ts", import.meta.url));
		writeFileSync(
			join(bin, "pnpm"),
			setupInstaller(pnpm, modules, hoistedPieces(), quality, skills, { scriptsOnly: linkedPackageScripts, stubbedQualityExit }),
			{
				mode: 0o755,
			},
		);
	}
	if (installer !== undefined) {
		rmSync(join(bin, "pnpm"));
		symlinkSync(installer, join(bin, "pnpm"));
	}
	const target = join(root, "my-app");
	if (["empty", "nonempty", "environment"].includes(destination)) {
		mkdirSync(target);
	}
	if (destination === "nonempty") {
		writeFileSync(join(target, ".keep"), "user data");
	}
	if (destination === "environment") {
		writeFileSync(join(target, ".env.local"), "user settings");
	}
	if (destination === "file") {
		writeFileSync(target, "user data");
	}
	if (!gitAvailable) {
		symlinkSync(process.execPath, join(bin, "node"));
	}
}

export function runCli(root: string, cli: string, gitAvailable: boolean, args: readonly string[], environment: readonly string[] = [], cwd = root) {
	const bin = join(root, "bin");
	const path = Effect.runSync(Config.String("PATH"));
	return Effect.scoped(
		Effect.gen(function* () {
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const [command, ...rest] = isolatedGitCommand([
				"env",
				`PATH=${gitAvailable ? `${bin}:${path}` : bin}`,
				"NODE_OPTIONS=",
				...environment,
				process.execPath,
				"--conditions=@shivaedev/source",
				cli,
				...args,
			]);
			const child = yield* spawner.spawn(ChildProcess.make(command, rest, { cwd }));
			const [stdout, stderr, status] = yield* Effect.all(
				[Stream.mkString(Stream.decodeText(child.stdout)), Stream.mkString(Stream.decodeText(child.stderr)), child.exitCode],
				{ concurrency: "unbounded" },
			);
			return { status: Number(status), stderr, stdout };
		}),
	);
}
