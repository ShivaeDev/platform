import { Buffer } from "node:buffer";
import { randomBytes } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { Console, Effect, FileSystem, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { CreateAppError } from "./CreateAppError.ts";
import { appDatabase, renderAppFile } from "./renderAppFile.ts";
import { Template } from "./template.ts";

const decodeName = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)));

export const createApp = Effect.fn("CreateApp.createApp")(function* (folder: string, templatePath: string) {
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
		const path = join(target, renderAppFile(entry.path, name));
		let content = Buffer.from(renderAppFile(Buffer.from(entry.content, "base64").toString(), name));
		if (entry.path === "package.json") {
			const manifest = yield* decodeName(content.toString());
			content = Buffer.from(`${JSON.stringify({ ...manifest, name }, null, "\t")}\n`);
		}
		yield* fs.makeDirectory(dirname(path), { recursive: true });
		yield* fs.writeFile(path, content);
		yield* fs.chmod(path, 0o644);
	}
	yield* fs.symlink("AGENTS.md", join(target, "CLAUDE.md"));
	const database = appDatabase(name);
	yield* fs.writeFileString(
		join(target, ".env.local"),
		`DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/${database}_dev\nTEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/${database}_test\nBETTER_AUTH_SECRET=${randomBytes(32).toString("base64url")}\n`,
		{ flag: "wx", mode: 0o600 },
	);
	yield* fs.chmod(join(target, ".env.local"), 0o600);
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	for (const command of ["install", "format"]) {
		const code = yield* spawner.exitCode(ChildProcess.make("pnpm", [command], { cwd: target, stderr: "inherit", stdout: "inherit" }));
		for (const entry of template) {
			yield* fs.chmod(join(target, renderAppFile(entry.path, name)), 0o644);
		}
		const lockfile = join(target, "pnpm-lock.yaml");
		if (yield* fs.exists(lockfile)) {
			yield* fs.chmod(lockfile, 0o644);
		}
		if (code !== 0) {
			return yield* new CreateAppError({ message: `pnpm ${command} failed (exit ${code}). Run pnpm ${command} in ${folder} to retry.` });
		}
	}
	const quotedFolder = `'${folder.replaceAll("'", "'\"'\"'")}'`;
	yield* Console.log(`Created ${folder}.\n\nNext steps:\n  cd ${quotedFolder}\n  pnpm dev`);
});
