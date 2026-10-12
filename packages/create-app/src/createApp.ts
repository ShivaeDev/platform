import { Buffer } from "node:buffer";
import { basename, dirname, join, resolve } from "node:path";
import { Console, Effect, FileSystem, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { CreateAppError } from "./CreateAppError.ts";
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
		const path = join(target, entry.path);
		let content = Buffer.from(entry.content, "base64");
		if (entry.path === "package.json") {
			const manifest = yield* decodeName(content.toString());
			content = Buffer.from(`${JSON.stringify({ ...manifest, name }, null, 2)}\n`);
		}
		yield* fs.makeDirectory(dirname(path), { recursive: true });
		yield* fs.writeFile(path, content);
	}
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const code = yield* spawner.exitCode(ChildProcess.make("pnpm", ["install"], { cwd: target, stderr: "inherit", stdout: "inherit" }));
	if (code !== 0) {
		return yield* new CreateAppError({ message: `pnpm install failed (exit ${code}). Run pnpm install in ${folder} to retry.` });
	}
	const quotedFolder = `'${folder.replaceAll("'", "'\"'\"'")}'`;
	yield* Console.log(
		`Created ${folder}.\n\nNext steps:\n  cd ${quotedFolder}\n  cp .env.example .env.local\n  Set DATABASE_URL to your PostgreSQL database.\n  Set BETTER_AUTH_SECRET to a random secret of at least 32 characters.\n  pnpm dev`,
	);
});
