import { Effect } from "effect";
import { cliProcess } from "#test/fleetCli.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

export interface HostCliOptions {
	readonly holdStdin?: boolean;
	readonly selection?: "board" | "port";
	readonly stdin?: string;
}

export function hostCli(engine: HostStoryEngine, args: readonly string[], options: HostCliOptions) {
	const observe = args[0] === "answer" || args[0] === "release" ? engine.observeAnswers(engine.fleet) : Effect.void;
	return observe.pipe(
		Effect.andThen(
			Effect.promise(async () => {
				let stderr = "";
				const selection = options.selection === "port" ? ["--port", String(engine.running.port)] : ["--board", engine.fixture.host.boardDir];
				const result = await cliProcess([...args, ...selection], {
					onError: (text) => {
						stderr += text;
					},
					...(options.stdin === undefined ? {} : { stdin: options.stdin }),
					...(options.holdStdin === undefined ? {} : { holdStdin: options.holdStdin }),
				});
				return { ...result, stderr: stderr.trim() };
			}),
		),
	);
}
