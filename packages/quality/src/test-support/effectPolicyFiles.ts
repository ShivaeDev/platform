import { mkdirSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Finding } from "#rule.ts";
import { ruleStory } from "./ruleStory.ts";
import type { SeedFile } from "./tree.ts";

export const SERVICE_DECLARATION =
	'import { Context, Effect } from "effect"; export interface StoreShape { readonly read: () => Effect.Effect<string> } export class Store extends Context.Service<Store, StoreShape>()("Store") {}';

const BOUNDARY_GUIDANCE =
	"Model the work with Effect; fail with a tagged error (or Effect.die for a defect). Move a bridge to an outside library into an adapters/ folder, returning Effect values.";

const SERVICE_GUIDANCE =
	"Read services from Effect's environment instead of passing them; return an Effect or Stream with requirements. Service implementation methods and Layer constructors are accepted; only test-support/ folders are exempt, not adapters/.";

export function usesAt(file: string, line: number, construct: string): Finding {
	return { file, line, message: `Uses ${construct}. ${BOUNDARY_GUIDANCE}` };
}

export function carries(parameter: string): string {
	return `Parameter ${parameter} carries a service. ${SERVICE_GUIDANCE}`;
}

export function serviceModule(path: string, ...lines: readonly string[]): SeedFile {
	return { content: [SERVICE_DECLARATION, ...lines].join("\n"), path };
}

// The service rule builds a TypeScript program, which needs effect's own types to recognise a service.
export function effectResolves() {
	return ruleStory.trait("repository", "effect and vitest resolve from node_modules", (engine) => {
		for (const name of ["effect", "vitest"]) {
			const link = join(engine.root, "node_modules", name);
			mkdirSync(dirname(link), { recursive: true });
			symlinkSync(dirname(createRequire(import.meta.url).resolve(`${name}/package.json`)), link, "dir");
		}
	});
}
