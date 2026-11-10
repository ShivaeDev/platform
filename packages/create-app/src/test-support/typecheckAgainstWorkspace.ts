import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { scriptOutcome } from "#test/answers.ts";
import { appScript, workspaceConditions } from "#test/environment.ts";

export function typecheckAgainstWorkspace(app: string, starter: string, story: { readonly tell: (line: string) => void }) {
	return Effect.sync(() => {
		story.tell("the app runs its typecheck script against workspace packages");
		workspaceConditions(app, starter);
		const manifestPath = join(app, "package.json");
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
		const source = JSON.parse(readFileSync(new URL("../../../../examples/starter/package.json", import.meta.url), "utf8"));
		manifest.scripts.typecheck = source.scripts.typecheck;
		writeFileSync(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
		return scriptOutcome(appScript(app, "typecheck"));
	});
}
