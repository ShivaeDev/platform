import type { SeedFile } from "@shivaedev/test-kits/quality/adapters/tree.ts";

export const nonEffectFixFiles: readonly SeedFile[] = [
	{ content: 'export default { nonEffectFolders: ["src/simulation"], sources: ["src"] };', path: "quality.config.ts" },
	{ content: "export async function time(){return Date.now()}", path: "src/simulation/time.ts" },
];
