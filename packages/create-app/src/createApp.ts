import { Buffer } from "node:buffer";
import { randomBytes } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { Console, Effect, FileSystem, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { appFile, databaseName } from "./appFiles.ts";
import { CreateAppError } from "./CreateAppError.ts";
import { commitGit, initializeGit } from "./initializeGit.ts";
import { Template } from "./template.ts";

export const createApp = Effect.fn("CreateApp.createApp")(function* (folder: string, templatePath: string, options: { readonly git: boolean }) {
	const fs = yield* FileSystem.FileSystem;
	const target = resolve(folder);
	const name = basename(target);
	if (!/^[a-z0-9][a-z0-9._-]*$/u.test(name) || name.length > 214 || ["node_modules", "favicon.ico"].includes(name)) {
		return yield* new CreateAppError({ message: "The final folder name must be a lowercase npm package name." });
	}
	if ((yield* fs.exists(target)) && ((yield* fs.stat(target)).type !== "Directory" || (yield* fs.readDirectory(target)).length > 0)) {
		return yield* new CreateAppError({ message: `Refusing to write into ${folder}: the destination must be an empty folder.` });
	}
	const template = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Template))(yield* fs.readFileString(templatePath));
	yield* fs.makeDirectory(target, { recursive: true });
	for (const entry of template) {
		const path = join(target, entry.path);
		const source = Buffer.from(entry.content, "base64");
		const content = yield* Effect.try({
			catch: (cause) => new CreateAppError({ message: String(cause) }),
			try: () =>
				["package.json", ".env.example", "AGENTS.md", "README.md"].includes(entry.path)
					? Buffer.from(appFile(entry.path, source.toString(), name))
					: source,
		});
		yield* fs.makeDirectory(dirname(path), { recursive: true });
		yield* fs.writeFile(path, content, { mode: 0o644 });
		yield* fs.chmod(path, 0o644);
	}
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
	for (const file of [...template.map((entry) => entry.path), "pnpm-lock.yaml"]) {
		const path = join(target, file);
		if (yield* fs.exists(path)) {
			yield* fs.chmod(path, 0o644);
		}
	}
	if (code !== 0) {
		return yield* new CreateAppError({ message: `pnpm run setup failed (exit ${code}). Run pnpm run setup in ${folder} to retry.` });
	}
	if (initialized) {
		yield* commitGit(target);
	}
	const quotedFolder = `'${folder.replaceAll("'", "'\"'\"'")}'`;
	yield* Console.log(`Created ${folder}.\n\nNext steps:\n  cd ${quotedFolder}\n  pnpm dev`);
});
