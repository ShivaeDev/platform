import { basename, dirname, join, relative, resolve } from "node:path";
import { Console, Effect, FileSystem } from "effect";
import { CONFIG_FILE } from "#config/file.ts";
import { loadConfig } from "#config/load.ts";
import { SetupFailure } from "#failure.ts";
import { readOptionalText } from "#inventory/filesystem.ts";
import { commandWords, hookCommand, type Launch, shellWords } from "./command.ts";
import { type HookLocation, hookLocation } from "./location.ts";
import { hookShim, isHookShim } from "./shim.ts";

export interface HookInstall {
	readonly config: string | undefined;
	readonly cwd: string;
	readonly force: boolean;
	readonly launch: Launch;
}

function failed(error: { readonly message: string }): SetupFailure {
	return new SetupFailure({ message: error.message });
}

const realPath = Effect.fnUntraced(function* (path: string) {
	const fs = yield* FileSystem.FileSystem;
	return yield* Effect.mapError(fs.realPath(path), failed);
});

const write = Effect.fnUntraced(function* (file: string, text: string) {
	const fs = yield* FileSystem.FileSystem;
	yield* fs.makeDirectory(dirname(file), { recursive: true }).pipe(
		Effect.andThen(fs.writeFileString(file, text)),
		Effect.andThen(fs.chmod(file, 0o755)),
		Effect.mapError((error) => new SetupFailure({ message: `cannot write ${file}: ${error.message}` })),
	);
});

function elsewhere(location: HookLocation): Effect.Effect<void> {
	return location.hooksPath === undefined || resolve(location.toplevel, location.hooksPath) === dirname(location.file)
		? Effect.void
		: Console.error(
				`note: core.hooksPath is ${location.hooksPath}, so git runs the pre-commit hook there; ${location.file} runs only when that hook calls it.`,
			);
}

export const installHook = Effect.fn("Hooks.installHook")(function* (install: HookInstall) {
	const config = yield* loadConfig(install.cwd, install.config);
	const location = yield* hookLocation(config.root);
	const root = yield* realPath(config.root);
	const script = join(yield* realPath(dirname(install.launch.script)), basename(install.launch.script));
	const name = basename(config.file);
	const command = hookCommand(root, { options: install.launch.options, script }, name === CONFIG_FILE ? undefined : name);
	const directory = relative(location.toplevel, root);
	const shim = hookShim(directory, command);
	const words = shellWords(commandWords(command));
	const existing = yield* Effect.mapError(readOptionalText(location.file), failed);
	const foreign = existing !== undefined && !isHookShim(existing);
	if (foreign && !install.force) {
		const call = `${directory === "" ? "" : `cd ${shellWords([directory])} && `}${words}`;
		yield* Console.error(
			`quality: kept ${location.file}: it is not quality's pre-commit hook, so quality does not check commits.\nhelp: call \`${call}\` from that hook, or replace it with \`quality hooks install --force\`.`,
		);
	} else if (existing === shim) {
		yield* Console.log(`quality: the pre-commit hook at ${location.file} is up to date.`);
	} else {
		yield* write(location.file, shim);
		const done = foreign ? `replaced ${location.file}, which was not quality's hook` : `installed the pre-commit hook at ${location.file}`;
		yield* Console.log(`quality: ${done}; each commit runs \`${words}\`.`);
	}
	yield* elsewhere(location);
});
