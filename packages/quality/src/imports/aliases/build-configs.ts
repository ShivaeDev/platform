import { posix } from "node:path";
import ts from "typescript";
import { field, isRecord } from "./pattern.ts";

export const UNKNOWN_BUILD = "unknown";

const MANIFEST = "package.json";

const CONFIG = "tsconfig.json";

const FALLBACKS = ["tsconfig.build.json", CONFIG];

const COMPILER = /^(?:tsc\d*|tsgo)$/u;

const SEPARATOR = /&&|\|\||[;&|]/u;

const SPACE = /\s+/u;

const QUOTES = /^["']|["']$/gu;

const PROJECT_FLAGS = new Set(["-p", "--project"]);

const NO_EMIT = "--noemit";

function configAt(directory: string, path: string): string {
	const joined = posix.join(directory, path);
	return posix.extname(joined) === ".json" ? joined : posix.join(joined, CONFIG);
}

// A compiler run that does not emit is no build; one whose flags change the output, or that names no plain project, has no known output.
function invokedConfig(tokens: readonly string[], directory: string): string | undefined {
	let config = posix.join(directory, CONFIG);
	for (let index = 0; index < tokens.length; index += 1) {
		const [flag = "", inline] = (tokens[index] ?? "").split("=");
		const name = flag.toLowerCase();
		if (name === NO_EMIT && inline !== "false") {
			return undefined;
		}
		if (!PROJECT_FLAGS.has(name)) {
			return UNKNOWN_BUILD;
		}
		const value = inline ?? tokens[index + 1];
		index += inline === undefined ? 1 : 0;
		if (value === undefined) {
			return UNKNOWN_BUILD;
		}
		config = configAt(directory, value);
	}
	return config;
}

function scriptConfigs(directory: string): readonly string[] {
	const text = ts.sys.readFile(posix.join(directory, MANIFEST));
	let manifest: unknown;
	try {
		manifest = text === undefined ? undefined : JSON.parse(text);
	} catch {
		return [UNKNOWN_BUILD];
	}
	const scripts = field(manifest, "scripts");
	const commands = isRecord(scripts) ? Object.values(scripts).filter((command) => typeof command === "string") : [];
	return commands.flatMap((command) =>
		command.split(SEPARATOR).flatMap((segment) => {
			const tokens = segment
				.trim()
				.split(SPACE)
				.map((token) => token.replace(QUOTES, ""));
			const at = tokens.findIndex((token) => COMPILER.test(posix.basename(token)));
			const config = at === -1 ? undefined : invokedConfig(tokens.slice(at + 1), directory);
			return config === undefined ? [] : [config];
		}),
	);
}

// The configs a package script compiles are its build; only without one do tsconfig.build.json and tsconfig.json stand in.
export function buildConfigs(directory: string): readonly string[] {
	const named = scriptConfigs(directory);
	return named.length > 0 ? [...new Set(named)] : FALLBACKS.map((name) => posix.join(directory, name)).filter((path) => ts.sys.fileExists(path));
}
