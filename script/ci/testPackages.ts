import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";

const Manifest = Schema.Struct({ name: Schema.String, scripts: Schema.optional(Schema.Record(Schema.String, Schema.String)) });
const decode = Schema.decodeUnknownSync(Schema.fromJsonString(Manifest));

export function testPackages(root: string) {
	return readdirSync(join(root, "packages"))
		.sort()
		.flatMap((name) => {
			const directory = join(root, "packages", name);
			const path = join(directory, "package.json");
			if (!existsSync(path)) {
				return [];
			}
			const manifest = decode(readFileSync(path, "utf8"));
			if (manifest.scripts?.test === undefined) {
				return [];
			}
			const configFile = join(directory, "vitest.config.ts");
			if (!existsSync(configFile)) {
				throw new Error(`${manifest.name}: add a Vitest config for workspace tests`);
			}
			return [{ configFile, directory, name: manifest.name }];
		});
}
