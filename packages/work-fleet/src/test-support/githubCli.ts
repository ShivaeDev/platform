import process from "node:process";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

export function githubCli(responses: ReadonlyMap<string, string>, exitCode = 0) {
	const commands: ChildProcess.Command[] = [];
	const layer = Layer.effect(ChildProcessSpawner.ChildProcessSpawner)(
		Effect.gen(function* () {
			const native = yield* ChildProcessSpawner.ChildProcessSpawner;
			return ChildProcessSpawner.make((command) => {
				commands.push(command);
				const endpoint = command._tag === "StandardCommand" ? command.args.at(-1) : undefined;
				const output = responses.get(endpoint ?? "") ?? "{}";
				return native.spawn(
					ChildProcess.make(process.execPath, [
						"--eval",
						"process.stdout.write(process.argv[1]); process.exitCode = Number(process.argv[2]);",
						output,
						String(exitCode),
					]),
				);
			});
		}),
	).pipe(Layer.provide(NodeServices.layer));
	return { commands, layer };
}
