import { relative } from "node:path";

const FRAMES = 50;

// V8 formats a stack only when it is read, so a site costs little until a test fails.
export function callSite(): Error {
	const limit = Error.stackTraceLimit;
	Error.stackTraceLimit = FRAMES;
	const site = new Error("call site");
	Error.stackTraceLimit = limit;
	return site;
}

export function locate(stack: string | undefined, testFile: string): string | undefined {
	const frame = stack?.split("\n").find((line) => line.includes(testFile));
	const position = frame?.slice(frame.indexOf(testFile) + testFile.length).match(/^:(?<line>\d+):(?<column>\d+)/u)?.groups;
	return position === undefined ? undefined : `${relative(process.cwd(), testFile)}:${position.line}:${position.column}`;
}
