import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Console, Effect } from "effect";
import { postgresTestEnvironment } from "#lib/postgresTestEnvironment.ts";

const program = Effect.gen(function* () {
	const environment = yield* postgresTestEnvironment;
	for (const [name, value] of Object.entries(environment)) {
		yield* Console.log(`export ${name}='${value}'`);
	}
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
