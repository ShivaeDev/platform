import { isAbsolute, relative, sep } from "node:path";

export interface Launch {
	readonly options: readonly string[];
	readonly script: string;
}

export interface HookCommand {
	readonly args: readonly string[];
	readonly launcher: string;
	readonly runner: readonly string[];
}

const BIN = "node_modules/.bin/quality";
const SAFE = /^[\w@%+=:,./-]+$/u;

// A quality run from a file in the repository, such as its own source, is run the same way by the hook; an installed one through its bin.
export function hookCommand(root: string, launch: Launch, config: string | undefined): HookCommand {
	const script = relative(root, launch.script);
	const installed = script.startsWith("..") || isAbsolute(script) || script.split(sep).includes("node_modules");
	return {
		args: ["hooks", "pre-commit", ...(config === undefined ? [] : ["--config", config])],
		launcher: installed ? BIN : script,
		runner: installed ? [] : ["node", ...launch.options],
	};
}

export function commandWords(command: HookCommand): readonly string[] {
	return [...command.runner, command.launcher, ...command.args];
}

export function shellWords(words: readonly string[]): string {
	return words.map((word) => (SAFE.test(word) ? word : `'${word.replaceAll("'", `'\\''`)}'`)).join(" ");
}
