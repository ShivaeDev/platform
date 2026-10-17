import { Schema } from "effect";

const decodeManifest = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)));

export function databaseName(name: string) {
	return name
		.replaceAll(/[.-]/gu, "_")
		.replace(/^[^a-z]/u, "app_$&")
		.slice(0, 58);
}

export function appFile(path: string, content: string, name: string) {
	if (path === "package.json") {
		return `${JSON.stringify({ ...decodeManifest(content), name }, null, "\t")}\n`;
	}
	if (path === ".env.example") {
		return content.replaceAll("starter_dev", `${databaseName(name)}_dev`).replaceAll("starter_test", `${databaseName(name)}_test`);
	}
	if (["AGENTS.md", "README.md"].includes(path)) {
		return content.replaceAll("{{appName}}", name);
	}
	return content;
}
