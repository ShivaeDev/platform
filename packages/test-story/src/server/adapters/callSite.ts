import { relative } from "node:path";
import process from "node:process";

const FRAMES = 50;

// Retaining the Error also retains V8's stack frames and their closed-over values.
export function callSite(): string | undefined {
	const limit = Error.stackTraceLimit;
	Error.stackTraceLimit = FRAMES;
	const site = new Error("call site");
	Error.stackTraceLimit = limit;
	return site.stack;
}

export function locate(stack: string | undefined, testFile: string): string | undefined {
	const frame = stack?.split("\n").find((line) => line.includes(testFile));
	const position = frame?.slice(frame.indexOf(testFile) + testFile.length).match(/^:(?<line>\d+):(?<column>\d+)/u)?.groups;
	return position === undefined ? undefined : `${relative(process.cwd(), testFile)}:${position.line}:${position.column}`;
}
