import { Buffer } from "node:buffer";
import { dirname, join } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import { appFile } from "./appFiles.ts";
import { CreateAppError } from "./CreateAppError.ts";
import { Template } from "./template.ts";

export const Generation = Schema.Struct({ minimal: Schema.optional(Schema.Boolean), name: Schema.String, version: Schema.String });
export type Generation = typeof Generation.Type;
export const GENERATION_FILE = ".create-app.json";

export const readTemplate = Effect.fn("CreateApp.readTemplate")(function* (path: string) {
	const fs = yield* FileSystem.FileSystem;
	return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Template))(yield* fs.readFileString(path));
});

export const writeGeneration = Effect.fn("CreateApp.writeGeneration")(function* (target: string, generation: Generation) {
	const fs = yield* FileSystem.FileSystem;
	yield* fs.writeFileString(join(target, GENERATION_FILE), `${JSON.stringify(generation, null, "\t")}\n`, { mode: 0o644 });
	yield* fs.chmod(join(target, GENERATION_FILE), 0o644);
});

export const renderTemplate = Effect.fn("CreateApp.renderTemplate")(function* (target: string, template: Template, name: string) {
	const fs = yield* FileSystem.FileSystem;
	for (const entry of template) {
		const path = join(target, entry.path);
		const content = yield* Effect.try({
			catch: (cause) => new CreateAppError({ message: `Failed to render template file ${entry.path}` }, { cause }),
			try: () => appFile(entry.path, Buffer.from(entry.content, "base64"), name),
		});
		yield* fs.makeDirectory(dirname(path), { recursive: true });
		yield* fs.writeFile(path, content, { mode: 0o644 });
		yield* fs.chmod(path, 0o644);
	}
});
