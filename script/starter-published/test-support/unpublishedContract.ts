import { join } from "node:path";
import { FileSystem } from "effect";
import { writeJson } from "#package-check/io.ts";
import { app } from "./app.ts";

export const unpublishedContract = app.trait("source", "the packed contract has query but no stream or live server", function* ({ root }) {
	const fs = yield* FileSystem.FileSystem;
	const source = join(root, "source");
	yield* writeJson(join(source, "package.json"), {
		exports: {
			"./contract.ts": { import: "./contract.js", types: "./contract.d.ts" },
			"./keys.ts": { import: "./keys.js", types: "./keys.d.ts" },
			"./operation.ts": { import: "./operation.js", types: "./operation.d.ts" },
			"./resume.ts": { import: "./resume.js", types: "./resume.d.ts" },
		},
		name: "@shivaedev/contract",
		type: "module",
		version: "0.1.0",
	});
	for (const [path, content] of Object.entries({
		"contract.d.ts": "export interface Contract { readonly name: string }\n",
		"contract.js": "export {};\n",
		"keys.d.ts": "export declare const key: string;\n",
		"keys.js": 'export const key = "key";\n',
		"operation.d.ts": "export declare const query: number;\nexport interface Streaming { readonly value: string }\n",
		"operation.js": "export const query = 42;\n",
		"resume.d.ts": "export declare const resumeSignal: string;\n",
		"resume.js": 'export const resumeSignal = "resume";\n',
	})) {
		yield* fs.writeFileString(join(source, path), content);
	}
});
