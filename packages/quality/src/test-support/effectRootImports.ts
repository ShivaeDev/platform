import * as Effect from "effect";
import type { SeedFile } from "#testing/adapters/tree.ts";

// Built from the installed Effect, so a root module Effect adds over a global reaches the story without an edit.
export function effectRootImports(path: string): SeedFile {
	return { content: `import { ${Object.keys(Effect).join(", ")} } from "effect";\n`, path };
}
