import { Option } from "effect";

export const USAGE = "Usage: heavy-lock -- <command> [args...]";

export type CommandLine = readonly [string, ...string[]];

export const parseCommandLine = (args: readonly string[]): Option.Option<CommandLine> => {
	const [separator, executable, ...rest] = args;
	return separator === "--" && executable !== undefined ? Option.some([executable, ...rest]) : Option.none();
};
