import { Buffer } from "node:buffer";
import { decodeManifest, manifestJson } from "#template.ts";

export function databaseName(name: string) {
	return name
		.replaceAll(/[.-]/gu, "_")
		.replace(/^[^a-z]/u, "app_$&")
		.slice(0, 58);
}

export function appFile(path: string, content: Buffer, name: string) {
	if (path === "package.json") {
		return Buffer.from(manifestJson({ ...decodeManifest(content.toString()), name }));
	}
	if (path === ".env.example") {
		return Buffer.from(
			content
				.toString()
				.replaceAll("starter_dev", `${databaseName(name)}_dev`)
				.replaceAll("starter_test", `${databaseName(name)}_test`),
		);
	}
	if (["AGENTS.md", "README.md"].includes(path)) {
		return Buffer.from(content.toString().replaceAll("{{appName}}", name));
	}
	return content;
}
