import { Buffer } from "node:buffer";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { packTemplate } from "#packTemplate.ts";
import { decodeTemplate } from "#template.ts";

const folders: string[] = [];

export function templateSource({ realStarter = false, localArtifacts = false } = {}) {
	const root = mkdtempSync(join(tmpdir(), "create-app-template-"));
	folders.push(root);
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
		changeApp: (content: string) => writeFileSync(join(starter, "app.ts"), content),
		pack: async () => {
			await Effect.runPromise(packTemplate(starter, output).pipe(Effect.provide(NodeServices.layer)));
			return Object.fromEntries(
				decodeTemplate(readFileSync(output, "utf8")).map((entry) => [entry.path, Buffer.from(entry.content, "base64").toString()]),
			);
		},
		starter,
	};
}

export function removeTemplates() {
	for (const folder of folders.splice(0)) {
		rmSync(folder, { force: true, recursive: true });
	}
}
