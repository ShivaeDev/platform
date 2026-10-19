import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = fileURLToPath(new URL("../..", import.meta.url));

// Every module the first page runs before any lazy chunk loads: the entry chunk and the chunks it imports statically.
export async function entryModules() {
	const result = await build({ build: { write: false }, configFile: `${root}vite.config.ts`, logLevel: "silent", root });
	const files = (Array.isArray(result) ? result : [result]).flatMap((bundle) => ("output" in bundle ? bundle.output : []));
	const chunks = new Map(files.flatMap((file) => (file.type === "chunk" ? [[file.fileName, file] as const] : [])));
	const pending = [...chunks.values()].filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName);
	const seen = new Set<string>();
	for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
		if (!seen.has(next)) {
			seen.add(next);
			pending.push(...(chunks.get(next)?.imports ?? []));
		}
	}
	return [...seen].flatMap((fileName) => chunks.get(fileName)?.moduleIds ?? []);
}
