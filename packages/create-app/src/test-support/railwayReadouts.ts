import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect, Schema } from "effect";
import { linkStarterModules } from "#test/starterModules.ts";

const Variables = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Array(Schema.String))));
const evaluate = `
import { createRailwayContext, project } from "railway/iac";
import configure from "./.railway/railway.ts";
const configured = await configure(createRailwayContext(), project);
console.log(JSON.stringify(Object.fromEntries(configured.resources
  .filter(resource => resource.type === "service")
  .map(service => [service.name, Object.entries(service.variables)
    .filter(([, value]) => value.type === "sharedReference")
    .map(([, value]) => value.name).sort()]))));
`;

export function railwayReadouts(target: () => string) {
	return {
		documentedRailwayVariables: () =>
			Effect.sync(() => {
				const readme = readFileSync(join(target(), "README.md"), "utf8");
				const byService: Record<string, string[]> = {};
				for (const row of readme.matchAll(/^\| `(?<variable>[A-Z_]+)` +\| (?<services>web(?:, worker)?|worker) +\|/gmu)) {
					for (const service of row.groups?.services?.split(", ") ?? []) {
						byService[service] ??= [];
						byService[service].push(row.groups?.variable ?? "");
					}
				}
				return Object.fromEntries(Object.entries(byService).map(([service, variables]) => [service, variables.sort()]));
			}),
		railwaySharedVariables: () =>
			Effect.sync(() => {
				if (!existsSync(join(target(), "node_modules"))) {
					linkStarterModules(target());
				}
				const result = spawnSync("node", ["--conditions=@shivaedev/source", "--input-type=module", "--eval", evaluate], {
					cwd: target(),
					encoding: "utf8",
				});
				if (result.status !== 0) {
					throw new Error(`The generated Railway configuration failed: ${result.stderr}`);
				}
				return Variables(result.stdout);
			}),
	};
}
