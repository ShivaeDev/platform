import { execFile } from "node:child_process";
import { isAbsolute, relative, sep } from "node:path";
import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/effect-contract/errors/taxonomy.ts";

export function localOnlyBoardPath(boardDir: string, repositoryRoot: string) {
	const path = relative(repositoryRoot, boardDir);
	if (path === "" || path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path)) {
		return Effect.succeed(undefined);
	}
	return Effect.callback<string | undefined, ServiceUnavailable>((resume) => {
		const child = execFile("git", ["check-ignore", "--quiet", "--", `${path}${sep}`], { cwd: repositoryRoot, timeout: 10_000 }, (error) => {
			if (error === null || error.code === 1) {
				resume(Effect.succeed(error === null ? path.split(sep).join("/") : undefined));
			} else {
				resume(Effect.fail(new ServiceUnavailable({ message: `Cannot check whether the Board directory is git-ignored: ${error.message}` })));
			}
		});
		return Effect.sync(() => {
			child.kill();
		});
	});
}
