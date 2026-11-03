import { pathToFileURL } from "node:url";
import { Deferred, Effect, Fiber, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { listeningUrl } from "#adapters/listeningUrl.ts";
import { CONSTRAINED_AGENT, TOOL_SERVER_NAME } from "#adapters/toolNames.ts";
import { opencodeFailure } from "#failure.ts";

const LOOPBACK = "127.0.0.1";
interface ServeOptions {
	readonly command: string;
	readonly constrained: boolean;
	readonly cwd: string;
	readonly plugin: string;
	readonly skills?: string | undefined;
	readonly tools?: string | undefined;
}
function serveArgs(port: string) {
	return ["serve", "--port", port, "--hostname", LOOPBACK];
}
const START_PATIENCE_MILLIS = 30_000;
// OpenCode resets this MCP deadline on progress notifications while a tool remains pending.
const TOOL_TIMEOUT = 300_000;
// Pure mode would disable the caller-session plugin and the tool bridge.
const CONSTRAINED_ENV = {
	"OPENCODE_DISABLE_CLAUDE_CODE_PROMPT": "1",
	"OPENCODE_DISABLE_EXTERNAL_SKILLS": "1",
	"OPENCODE_DISABLE_PROJECT_CONFIG": "1",
};
const CONSTRAINED_CONFIG = {
	agent: { [CONSTRAINED_AGENT]: { prompt: "Follow the instructions in the system message." } },
};
function configContent(options: ServeOptions): string {
	const mode = options.constrained ? CONSTRAINED_CONFIG : {};
	const skills = options.skills === undefined ? {} : { skills: { paths: [options.skills] } };
	return JSON.stringify({
		...(options.tools === undefined
			? {}
			: { mcp: { [TOOL_SERVER_NAME]: { timeout: TOOL_TIMEOUT, type: "remote", url: options.tools } }, plugin: [pathToFileURL(options.plugin).href] }),
		...mode,
		...(options.constrained ? {} : skills),
	});
}
function serveEnv(options: ServeOptions) {
	return {
		"OPENCODE_CONFIG_CONTENT": configContent(options),
		...(options.constrained ? CONSTRAINED_ENV : {}),
	};
}
const complaintsOf = Effect.fnUntraced(function* (child: ChildProcessSpawner.ChildProcessHandle) {
	const said = yield* Effect.forkScoped(Stream.mkString(Stream.decodeText(child.stderr)));
	return Effect.orElseSucceed(Fiber.join(said), () => "");
});
const addressPrintedBy = Effect.fnUntraced(function* (child: ChildProcessSpawner.ChildProcessHandle) {
	const printed = yield* Deferred.make<string>();
	yield* Effect.forkScoped(
		Stream.runForEach(Stream.decodeText(child.stdout).pipe(Stream.splitLines), (chunk) =>
			Effect.sync(() => {
				const address = listeningUrl(chunk);
				if (address !== undefined) {
					Deferred.doneUnsafe(printed, Effect.succeed(address));
				}
			}),
		),
	);
	return Deferred.await(printed);
});
function exitedFirst(child: ChildProcessSpawner.ChildProcessHandle, complaints: Effect.Effect<string>) {
	return Effect.flatMap(Effect.match(child.exitCode, { onFailure: String, onSuccess: String }), (reason) =>
		Effect.flatMap(complaints, (said) => Effect.fail(`opencode serve exited with ${reason}: ${said.slice(0, 500)}`)),
	);
}
export const serveOpencode = Effect.fnUntraced(function* (options: ServeOptions) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const port = "0";
	const child = yield* spawner.spawn(
		ChildProcess.make(options.command, serveArgs(port), {
			cwd: options.cwd,
			env: serveEnv(options),
			extendEnv: true,
			forceKillAfter: 5000,
			stdin: "ignore",
		}),
	);
	const complaints = yield* complaintsOf(child);
	const printed = yield* addressPrintedBy(child);
	const address = yield* Effect.raceFirst(printed, exitedFirst(child, complaints)).pipe(
		Effect.timeoutOrElse({
			duration: START_PATIENCE_MILLIS,
			orElse: () => Effect.fail(`opencode serve did not print its address on port ${port} in time`),
		}),
	);
	return address;
}, Effect.mapError(opencodeFailure));
