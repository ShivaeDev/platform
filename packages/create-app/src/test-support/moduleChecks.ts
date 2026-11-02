import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { scriptOutcome } from "./answers.ts";
import { appScript, workspaceConditions } from "./environment.ts";

export function moduleChecks(app: () => string, starter: string, story: { readonly tell: (line: string) => void }) {
	function run(script: "build" | "typecheck") {
		return Effect.sync(() => {
			story.tell(`the app runs its ${script} script against workspace packages`);
			workspaceConditions(app(), starter);
			const manifestPath = join(app(), "package.json");
			const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
			const source = JSON.parse(readFileSync(new URL("../../../../examples/starter/package.json", import.meta.url), "utf8"));
			manifest.scripts[script] = source.scripts[script];
			writeFileSync(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
			return scriptOutcome(appScript(app(), script));
		});
	}
	return {
		build: () => run("build"),
		typecheck: () => run("typecheck"),
	};
}
