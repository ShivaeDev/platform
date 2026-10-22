import process from "node:process";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Cause, Console, Effect } from "effect";
import { Argument, Command } from "effect/cli";
import { migrate } from "#server/migration/migrate.ts";
import { VERSION } from "#server/packageInfo.ts";

export function runMigrate() {
	const command = Command.make("migrate", { dir: Argument.Directory("dir", { mustExist: true }) }, ({ dir }) =>
		migrate(dir).pipe(
			Effect.flatMap(({ files, fields, unresolved }) =>
				Console.log(`Changed ${files} files and ${fields} fields.`).pipe(
					Effect.andThen(Effect.forEach(unresolved, (entry) => Console.log(`Unresolved replacement: ${entry}`), { discard: true })),
				),
			),
		),
	);
	const program = Command.runWith(command, { version: VERSION })(process.argv.slice(3)).pipe(
		Effect.provide(NodeServices.layer),
		Effect.tapCause((cause) => Console.error(Cause.pretty(cause))),
	);
	NodeRuntime.runMain(program, { disableErrorReporting: true });
}
