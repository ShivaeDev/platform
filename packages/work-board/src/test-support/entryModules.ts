import { fileURLToPath } from "node:url";

// Returns the modules of the entry chunk and the chunks it imports statically. DOM specs load this file through the serving verbs, where import.meta.url is not a file URL, so the path and Vite resolve only when a story builds.
export async function entryModules() {
	const root = fileURLToPath(new URL("../..", import.meta.url));
	const { build } = await import("vite");
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
