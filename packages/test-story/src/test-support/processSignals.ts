import { spawn } from "node:child_process";
import process from "node:process";
import { type Duration, Effect, Exit, Scope } from "effect";
import { lineSignals } from "#lineSignals.ts";
import { storyKit } from "#storyKit.ts";
import { background } from "./attempt.ts";

const childProgram = `
const readline = require("node:readline");
readline.createInterface({ input: process.stdin }).on("line", (command) => {
	const { channel, pieces, end } = JSON.parse(command);
	for (const piece of pieces) process[channel].write(Array.isArray(piece) ? Buffer.from(piece) : piece);
	if (end) process[channel].end();
});
`;

export const processSignals = storyKit({
	*create() {
		const child = yield* Effect.acquireRelease(
			Effect.sync(() => spawn(process.execPath, ["-e", childProgram], { stdio: "pipe" })),
			(started) =>
				Effect.promise(
					() =>
						new Promise<void>((resolve) => {
							started.once("close", () => resolve());
							started.kill();
						}),
				),
		);
		const scope = yield* Scope.fork(yield* Scope.Scope);
		const stdout = yield* lineSignals(child.stdout).pipe(Effect.provideService(Scope.Scope, scope));
		const stderr = yield* lineSignals(child.stderr).pipe(Effect.provideService(Scope.Scope, scope));
		return { child, scope, stderr, stdout };
	},
	name: "process signals",
	stages: ["ready"],
	verbs: ({ child, scope, stderr, stdout }, story) => {
		const running = background();
		function waitsForLine(text: string, channel: "stdout" | "stderr" = "stdout", timeout: Duration.Input = "5 seconds") {
			story.tell(`wait for ${channel} line "${text}"`);
			return { stderr, stdout }[channel].untilLine((line) => line === text, { name: `${channel} line "${text}"`, timeout });
		}
		return {
			closesReaders: () => {
				story.tell("the output readers scope closes");
				return Scope.close(scope, Exit.void);
			},
			finished: running.finished,
			outputs: (pieces: readonly (string | readonly number[])[], channel: "stdout" | "stderr" = "stdout", end = false) => {
				story.tell(`the child writes ${JSON.stringify(pieces)} to ${channel}${end ? " and ends it" : ""}`);
				return Effect.promise(
					() =>
						new Promise<void>((resolve) => {
							child[channel].once("data", () => resolve());
							child.stdin.write(`${JSON.stringify({ channel, end, pieces })}\n`);
						}),
				);
			},
			recordedLines: (channel: "stdout" | "stderr" = "stdout") => ({ stderr, stdout })[channel].lines,
			startsWaiting: (text: string, channel: "stdout" | "stderr" = "stdout") => running.starts(text, waitsForLine(text, channel), (line) => line),
			waitsForLine,
		};
	},
});
