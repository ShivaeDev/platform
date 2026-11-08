import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";

const Manifest = Schema.Struct({ name: Schema.String, scripts: Schema.optional(Schema.Record(Schema.String, Schema.String)) });
const decode = Schema.decodeUnknownSync(Schema.fromJsonString(Manifest));

export function packageFolders(root: string) {
	return ["packages", "examples"]
		.flatMap((zone) => (existsSync(join(root, zone)) ? readdirSync(join(root, zone)).map((name) => join(zone, name)) : []))
		.sort()
		.flatMap((name) => {
			const directory = join(root, name);
			const path = join(directory, "package.json");
			return existsSync(path) ? [{ directory, manifest: decode(readFileSync(path, "utf8")) }] : [];
		});
}

export function vitestConfig(name: string, directory: string) {
	const configFile = join(directory, "vitest.config.ts");
	if (!existsSync(configFile)) {
		throw new Error(`${name}: add a Vitest config for workspace tests`);
	}
	return configFile;
}
