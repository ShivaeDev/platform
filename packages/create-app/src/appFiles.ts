import { bytesOf, textOf } from "#fileContent.ts";
import { decodeManifest, manifestJson } from "#template.ts";

export function databaseName(name: string) {
	return name
		.replaceAll(/[.-]/gu, "_")
		.replace(/^[^a-z]/u, "app_$&")
		.slice(0, 58);
}

export function appFile(path: string, content: Uint8Array, name: string) {
	if (path === "package.json") {
		return bytesOf(manifestJson({ ...decodeManifest(textOf(content)), name }));
	}
	if (path === ".env.example") {
		return bytesOf(
			textOf(content)
				.replaceAll("starter_dev", `${databaseName(name)}_dev`)
				.replaceAll("starter_test", `${databaseName(name)}_test`),
		);
	}
	if (["AGENTS.md", "README.md"].includes(path)) {
		return bytesOf(textOf(content).replaceAll("{{appName}}", name));
	}
	return content;
}
