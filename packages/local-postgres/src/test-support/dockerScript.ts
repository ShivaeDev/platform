import type { ExecFileSyncOptionsWithStringEncoding } from "node:child_process";
import { isDeepStrictEqual } from "node:util";

export const PINNED_IMAGE = "postgres:18.6-alpine@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873";

export function dockerScript(steps: readonly { readonly args: readonly string[]; readonly result: string | Error }[]) {
	const remaining = [...steps];
	return {
		run(args: readonly string[], _options?: ExecFileSyncOptionsWithStringEncoding) {
			const index = remaining.findIndex((candidate) => isDeepStrictEqual(candidate.args, args));
			const step = index < 0 ? undefined : remaining.splice(index, 1)[0];
			if (!step) {
				throw new Error(`Unexpected Docker call: ${JSON.stringify(args)}`);
			}
			if (step.result instanceof Error) {
				throw step.result;
			}
			return step.result;
		},
	};
}
