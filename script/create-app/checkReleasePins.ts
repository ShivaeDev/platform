import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect, Schema } from "effect";
import { checkPins } from "./pins.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const decodeVersion = Schema.decodeUnknownSync(Schema.Struct({ version: Schema.String }));
const decodePins = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Schema.String)));
async function manifest(path: string) {
	return decodeVersion(JSON.parse(await readFile(path, "utf8"))).version;
}
async function latest(name: string) {
	const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`);
	if (!response.ok) {
		throw new Error(`npm answered ${response.status} for ${name}`);
	}
	return decodeVersion(await response.json()).version;
}

const version = await manifest(join(root, "packages/create-app/package.json"));
if (version === (await latest("@shivaedev/create-app"))) {
	await Effect.runPromise(Effect.log("No create-app release to check."));
} else {
	const pins = decodePins(await readFile(join(root, "examples/starter/published-versions.json"), "utf8"));
	const local = Object.fromEntries(
		await Promise.all(
			Object.keys(pins).map(async (name) => [name, await manifest(join(root, "packages", name.split("/")[1] ?? "", "package.json"))]),
		),
	);
	await checkPins(pins, local, latest);
	await Effect.runPromise(Effect.log("The create-app release pins the latest framework versions, including releases in this commit."));
}
