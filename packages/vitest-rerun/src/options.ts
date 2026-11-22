import { resolve } from "node:path";
import { Effect, Option } from "effect";
import { DEFAULT_OUTPUT_DIR, DEFAULT_RERUNS } from "#defaults.ts";
import { VitestRerunError } from "#error.ts";
import { parseVitestArguments } from "#parseVitestArguments.ts";

export interface RerunOptions {
	readonly cwd: string;
	readonly outputDir: string;
	readonly reruns: number;
	readonly vitestArgs: readonly string[];
}

const MODES = ["clearCache", "listTags", "mergeReports"] as const;

function refuseModes(vitestArgs: readonly string[]): Effect.Effect<void, VitestRerunError> {
	// An argument Vitest cannot parse fails the attempt, which names it.
	return Effect.option(parseVitestArguments(vitestArgs)).pipe(
		Effect.flatMap((parsed) => {
			const mode = Option.isSome(parsed) ? MODES.find((name) => Boolean(parsed.value.options[name])) : undefined;
			return mode === undefined
				? Effect.void
				: Effect.fail(new VitestRerunError({ message: `--${mode} runs no tests, so vitest-rerun cannot run it; run vitest --${mode} directly` }));
		}),
	);
}

function option(arg: string, name: string, next: string | undefined): { name: string; value: string | undefined; consumed: number } | undefined {
	if (arg === name) {
		return { consumed: 2, name, value: next === "" || next?.startsWith("--") ? undefined : next };
	}
	return arg.startsWith(`${name}=`) ? { consumed: 1, name, value: arg.slice(name.length + 1) || undefined } : undefined;
}

export function parseOptions(args: readonly string[], cwd: string): Effect.Effect<RerunOptions, VitestRerunError> {
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
		const parsed = output ?? count;
		if (parsed === undefined) {
			vitestArgs.push(arg);
		} else if (parsed.value === undefined) {
			return Effect.fail(new VitestRerunError({ message: `${parsed.name} expects a value` }));
		} else if (output === undefined) {
			reruns = parsed.value;
		} else {
			outputDir = parsed.value;
		}
		index += parsed?.consumed ?? 1;
	}
	if (!/^\d+$/u.test(reruns)) {
		return Effect.fail(new VitestRerunError({ message: `--reruns expects a whole number, got ${JSON.stringify(reruns)}` }));
	}
	return Effect.as(refuseModes(vitestArgs), { cwd, outputDir: resolve(cwd, outputDir), reruns: Number(reruns), vitestArgs });
}
