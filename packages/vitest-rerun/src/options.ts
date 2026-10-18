import { Effect } from "effect";
import { VitestRerunError } from "#error.ts";

export interface RerunOptions {
	readonly outputDir: string;
	readonly reruns: number;
	readonly vitestArgs: readonly string[];
}

export const DEFAULT_OUTPUT_DIR = "test-results";
export const DEFAULT_RERUNS = 1;

function option(arg: string, name: string, next: string | undefined): { value: string; consumed: number } | undefined {
	if (arg === name && next !== undefined) {
		return { consumed: 2, value: next };
	}
	return arg.startsWith(`${name}=`) ? { consumed: 1, value: arg.slice(name.length + 1) } : undefined;
}

export function parseOptions(args: readonly string[]): Effect.Effect<RerunOptions, VitestRerunError> {
	let outputDir = DEFAULT_OUTPUT_DIR;
	let reruns = String(DEFAULT_RERUNS);
	const vitestArgs: string[] = [];
	for (let index = 0; index < args.length; ) {
		const arg = args[index] ?? "";
		if (arg === "--") {
			vitestArgs.push(...args.slice(index + 1));
			break;
		}
		const output = option(arg, "--output-dir", args[index + 1]);
		const count = option(arg, "--reruns", args[index + 1]);
		if (output !== undefined) {
			outputDir = output.value;
		} else if (count === undefined) {
			vitestArgs.push(arg);
		} else {
			reruns = count.value;
		}
		index += output?.consumed ?? count?.consumed ?? 1;
	}
	if (!/^\d+$/u.test(reruns)) {
		return Effect.fail(new VitestRerunError({ message: `--reruns expects a whole number, got ${JSON.stringify(reruns)}` }));
	}
	return Effect.succeed({ outputDir, reruns: Number(reruns), vitestArgs });
}
