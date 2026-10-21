import process from "node:process";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { Argument, Command } from "effect/cli";
import { VERSION } from "#server/packageInfo.ts";
import { migrate } from "./migrate.ts";

export function runMigrate() {
	const command = Command.make("migrate", { dir: Argument.Directory("dir", { mustExist: true }) }, ({ dir }) =>
		migrate(dir).pipe(Effect.flatMap(({ files, fields }) => Console.log(`Changed ${files} files and ${fields} fields.`))),
	);
	Command.runWith(command, { version: VERSION })(process.argv.slice(3)).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
}
