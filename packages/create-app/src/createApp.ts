import { Buffer, isUtf8 } from "node:buffer";
import { randomBytes } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { Console, Effect, FileSystem, Schema } from "effect";
import { CreateAppError } from "./CreateAppError.ts";
import { installApp } from "./installApp.ts";
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
	const database = name
		.replaceAll(/[.-]/gu, "_")
		.replace(/^[^a-z]/u, "app_$&")
		.slice(0, 58);
	yield* fs.makeDirectory(target, { recursive: true });
	for (const entry of template) {
		const path = join(target, entry.path);
		let content = Buffer.from(entry.content, "base64");
		if (isUtf8(content)) {
			content = Buffer.from(
				content
					.toString()
					.replaceAll("__APP_NAME__", name)
					.replaceAll("__APP_DATABASE__", database)
					.replaceAll("__APP_NAMESPACE__", database.slice(0, 40)),
			);
		}
		if (entry.path === "package.json") {
			const manifest = yield* decodeName(content.toString());
			content = Buffer.from(`${JSON.stringify({ ...manifest, name }, null, "\t")}\n`);
		}
		yield* fs.makeDirectory(dirname(path), { recursive: true });
		yield* fs.writeFile(path, content);
		yield* fs.chmod(path, 0o644);
	}
	yield* fs.symlink("AGENTS.md", join(target, "CLAUDE.md"));
	yield* fs.writeFileString(
		join(target, ".env.local"),
		`DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/${database}_dev\nTEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/${database}_test\nBETTER_AUTH_SECRET=${randomBytes(32).toString("base64url")}\n`,
		{ flag: "wx", mode: 0o600 },
	);
	yield* fs.chmod(join(target, ".env.local"), 0o600);
	yield* installApp(
		target,
		folder,
		template.map((entry) => entry.path),
	);
	const quotedFolder = `'${folder.replaceAll("'", "'\"'\"'")}'`;
	yield* Console.log(`Created ${folder}.\n\nNext steps:\n  cd ${quotedFolder}\n  pnpm dev`);
});
