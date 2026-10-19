import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import type { FileSystemWrapper } from "./board.ts";

export function heldRegisteredRead(file: string) {
	let reached: () => void = () => undefined;
	let resume: () => void = () => undefined;
	const started = new Promise<void>((resolve) => {
		reached = resolve;
	});
	const released = new Promise<void>((resolve) => {
		resume = resolve;
	});
	let held = false;
	function registered(root: string) {
		const responses = join(root, "responses");
		return existsSync(responses) && readdirSync(responses).some((name) => name.startsWith("question."));
	}
	const wrap: FileSystemWrapper = (fs) => ({
		...fs,
		readFileString: (path, encoding) =>
			Effect.suspend(() => {
				if (held || !path.endsWith(`/${file}`) || !registered(path.slice(0, -file.length - 1))) {
					return fs.readFileString(path, encoding);
				}
				held = true;
				reached();
				return Effect.promise(() => released).pipe(Effect.andThen(fs.readFileString(path, encoding)));
			}),
	});
	return { release: resume, started, wrap };
}
