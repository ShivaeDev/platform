import process from "node:process";
import { Effect, Option } from "effect";
import { decodeHolder } from "#holder.ts";
import { type CliRun, type CommandLine, cliEnvironment, commands, startCli } from "./cliProcess.ts";
import { type Lock, nameOf } from "./lock.ts";
import { startTime } from "./startTime.ts";

function holderIdGiven(engine: Lock, run: CliRun) {
	const id = /^holder id=(?<id>.*)$/mu.exec(run.stdout())?.groups?.id ?? "";
	const lock = /^lock=(?<lock>.*)$/mu.exec(run.stdout())?.groups?.lock ?? "";
	if (id === "") {
		return "no holder id";
	}
	const recorded = Option.filter(decodeHolder(lock), (holder) => holder.id === id);
	return `${nameOf(engine, id, Option.getOrUndefined(Option.map(recorded, ({ pid }) => pid)))}'s holder id`;
}

export function cli(engine: Lock, tell: (line: string) => void) {
	const launch = Effect.fn("LockStory.launch")(function* (name: string, args: readonly string[]) {
		const run = yield* Effect.acquireRelease(
			Effect.sync(() => startCli(args, cliEnvironment(engine.lock, engine.env), engine.cliOptions.cwd)),
			(child) =>
				Effect.promise(async () => {
					child.stop();
					await child.exited;
				}),
		);
		engine.cliRuns[name] = run;
		return run;
	});
	function runOf(name: string) {
		const run = engine.cliRuns[name];
		return run === undefined ? Effect.die(new Error(`The CLI never ran ${name} in this story.`)) : Effect.succeed(run);
	}
	function exits(run: CliRun) {
		return Effect.promise(() => run.exited);
	}
	function afterExit<A>(name: string, read: (run: CliRun) => A) {
		return Effect.flatMap(runOf(name), (run) => Effect.map(exits(run), () => read(run)));
	}
	return {
		commands,
		exitCodeOf: (name: string) => Effect.flatMap(runOf(name), exits),
		holderIdGivenTo: (name: string) => afterExit(name, (run) => holderIdGiven(engine, run)),
		invokedWith: (name: string, args: readonly string[]) => {
			tell(`${name} invokes the CLI as heavy-lock ${args.join(" ")}`);
			return Effect.asVoid(Effect.flatMap(launch(name, args), exits));
		},
		ledItsProcessGroup: (name: string) => afterExit(name, (run) => run.stdout().includes("\nleads its process group\n")),
		pidOf: (name: string) => Effect.map(runOf(name), ({ pid }) => pid),
		printedBy: (name: string) =>
			afterExit(name, (run) =>
				run
					.stderr()
					.split("\n")
					.filter((line) => line !== ""),
			),
		ranItsCommand: (name: string) => afterExit(name, (run) => run.stdout().startsWith("running\n")),
		receives: (name: string, signal: NodeJS.Signals) =>
			Effect.gen(function* () {
				tell(`${name}'s CLI receives ${signal}`);
				const run = yield* runOf(name);
				process.kill(run.pid, signal);
				yield* exits(run);
			}),
		releases: (name: string) =>
			Effect.gen(function* () {
				tell(`${name}'s command is released and exits`);
				const run = yield* runOf(name);
				run.release();
				yield* exits(run);
			}),
		runs: (name: string, command: CommandLine) => {
			tell(`${name} runs heavy-lock -- ${command.join(" ")}`);
			return Effect.asVoid(Effect.flatMap(launch(name, ["--", ...command]), exits));
		},
		standardOutputOf: (name: string) => afterExit(name, (run) => run.stdout()),
		starts: (name: string, command: CommandLine) =>
			Effect.gen(function* () {
				tell(`${name} starts heavy-lock -- ${command.join(" ")}`);
				const run = yield* launch(name, ["--", ...command]);
				yield* Effect.promise(() => run.settled);
			}),
		startTimeOf: (name: string) => Effect.map(runOf(name), ({ pid }) => startTime(pid)),
		stateOf: (name: string) => Effect.map(runOf(name), (run) => run.state()),
	};
}
