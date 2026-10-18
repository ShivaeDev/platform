import { Buffer } from "node:buffer";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { packTemplate } from "#packTemplate.ts";
import { decodeTemplate } from "#template.ts";

export function templateSource(root: string, { realStarter = false, localArtifacts = false } = {}) {
	const starter = realStarter ? fileURLToPath(new URL("../../../../examples/starter", import.meta.url)) : join(root, "starter");
	const output = join(root, "template.json");
	if (!realStarter) {
		mkdirSync(starter);
		writeFileSync(join(starter, "published-versions.json"), "{}");
	}
	if (localArtifacts) {
		for (const name of ["node_modules", "dist", "coverage", ".git"]) {
			mkdirSync(join(starter, name));
			writeFileSync(join(starter, name, "ignored.txt"), "ignored");
		}
		for (const name of [".env.local", ".env", ".env.production", "pnpm-lock.yaml"]) {
			writeFileSync(join(starter, name), "private");
		}
		writeFileSync(join(starter, ".env.example"), "example");
	}
	return {
		changeApp: (content: string) => {
			if (realStarter) {
				throw new Error("Changing the template requires a custom template trait");
			}
			writeFileSync(join(starter, "app.ts"), content);
		},
		files: (files: Readonly<Record<string, string | Uint8Array>>) => {
			for (const [path, content] of Object.entries(files)) {
				mkdirSync(dirname(join(starter, path)), { recursive: true });
				writeFileSync(join(starter, path), content);
			}
		},
		output,
		pack: () =>
			packTemplate(starter, output).pipe(
				Effect.provide(NodeServices.layer),
				Effect.map(() =>
					Object.fromEntries(
						decodeTemplate(readFileSync(output, "utf8")).map((entry) => [entry.path, Buffer.from(entry.content, "base64").toString()]),
					),
				),
			),
		readPacked: (path: string) => {
			const entry = decodeTemplate(readFileSync(output, "utf8")).find((file) => file.path === path);
			if (entry === undefined) {
				throw new Error(`No packed file: ${path}`);
			}
			return Buffer.from(entry.content, "base64");
		},
		starter,
	};
}
