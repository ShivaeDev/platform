import { randomBytes } from "node:crypto";
import { basename, join, resolve } from "node:path";
import { Console, Effect, FileSystem } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { databaseName } from "./appFiles.ts";
import { CreateAppError } from "./CreateAppError.ts";
import { readTemplate, renderTemplate, writeGeneration } from "./generation.ts";
import { commitGit, initializeGit } from "./initializeGit.ts";
import { appTemplate } from "./template.ts";

export const createApp = Effect.fn("CreateApp.createApp")(function* (
	folder: string,
	templatePath: string,
	options: { readonly git: boolean; readonly minimal: boolean; readonly version: string },
) {
	const fs = yield* FileSystem.FileSystem;
	const target = resolve(folder);
	const name = basename(target);
	if (!/^[a-z0-9][a-z0-9._-]*$/u.test(name) || name.length > 214 || ["node_modules", "favicon.ico"].includes(name)) {
		return yield* new CreateAppError({ message: "The final folder name must be a lowercase npm package name." });
	}
	if ((yield* fs.exists(target)) && ((yield* fs.stat(target)).type !== "Directory" || (yield* fs.readDirectory(target)).length > 0)) {
		return yield* new CreateAppError({ message: `Refusing to write into ${folder}: the destination must be an empty folder.` });
	}
	const template = appTemplate(yield* readTemplate(templatePath), options.minimal);
	yield* fs.makeDirectory(target, { recursive: true });
	yield* renderTemplate(target, template, name);
	yield* writeGeneration(target, { ...(options.minimal ? { minimal: true } : {}), name, version: options.version });
	yield* fs.symlink("AGENTS.md", join(target, "CLAUDE.md"));
	const database = databaseName(name);
	yield* fs.writeFileString(
		join(target, ".env.local"),
		`DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/${database}_dev\nTEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/${database}_test\nBETTER_AUTH_SECRET=${randomBytes(32).toString("base64url")}\n`,
		{ flag: "wx", mode: 0o600 },
	);
	const initialized = options.git && (yield* initializeGit(target));
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const code = yield* spawner.exitCode(ChildProcess.make("pnpm", ["run", "setup"], { cwd: target, stderr: "inherit", stdout: "inherit" }));
	if (code !== 0) {
		return yield* new CreateAppError({ message: `pnpm run setup failed (exit ${code}). Run pnpm run setup in ${folder} to retry.` });
	}
	const formatted = yield* spawner.exitCode(ChildProcess.make("pnpm", ["run", "format"], { cwd: target, stderr: "inherit", stdout: "inherit" }));
	if (formatted !== 0) {
		return yield* new CreateAppError({ message: `pnpm run format failed (exit ${formatted}). Run pnpm run format in ${folder} to retry.` });
	}
	for (const file of [...template.map((entry) => entry.path), "pnpm-lock.yaml"]) {
		const path = join(target, file);
		if (yield* fs.exists(path)) {
			yield* fs.chmod(path, 0o644);
		}
	}
	if (initialized) {
		yield* commitGit(target);
	}
	const quotedFolder = `'${folder.replaceAll("'", "'\"'\"'")}'`;
	yield* Console.log(`Created ${folder}.\n\nNext steps:\n  cd ${quotedFolder}\n  pnpm dev`);
});
