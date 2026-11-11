import { join } from "node:path";
import { Effect } from "effect";
import { cliAnswer, scriptOutcome } from "#test/answers.ts";
import { runCli } from "#test/cli.ts";
import { appScript, workspaceConditions } from "#test/environment.ts";
import type { Engine } from "#test/generate.ts";

export function resourceActions(engine: Engine, story: { readonly tell: (line: string) => void }) {
	function app() {
		return join(engine.root, engine.app);
	}
	function addResourceAt(folder: string, name: string) {
		return Effect.gen(function* () {
			story.tell(`create-app resource ${name}`);
			const result = yield* runCli(engine.root, engine.cli, true, ["resource", name], engine.environment, folder);
			return cliAnswer(result, engine.root, () => "added");
		});
	}
	return {
		addResource: (name: string) => addResourceAt(app(), name),
		addResourceOutsideApp: (name: string) => addResourceAt(engine.root, name),
		lint: () =>
			Effect.sync(() => {
				story.tell("the app runs its lint script");
				workspaceConditions(app(), engine.source.starter);
				return scriptOutcome(appScript(app(), "lint"));
			}),
		runResourceStories: (...names: readonly string[]) =>
			Effect.sync(() => {
				story.tell(`the app runs the generated ${names.join(" and ")} PostgreSQL stories`);
				workspaceConditions(app(), engine.source.starter);
				return scriptOutcome(
					appScript(app(), "test", [
						...names.map((name) => `src/modules/${name}/server/lifecycle.spec.ts`),
						"--configLoader",
						"native",
						"--maxWorkers",
						"2",
					]),
				);
			}),
	};
}
