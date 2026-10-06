import type { ExecFileSyncOptionsWithStringEncoding } from "node:child_process";
import { expect } from "vitest";

export const PINNED_IMAGE = "postgres:18.6-alpine@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873";

export function dockerScript(steps: readonly { readonly args: readonly string[]; readonly result: string | Error }[]) {
	let next = 0;
	return {
		done() {
			expect(next).toBe(steps.length);
		},
		run(args: readonly string[], _options?: ExecFileSyncOptionsWithStringEncoding) {
			const step = steps[next];
			next += 1;
			if (!step) {
				throw new Error(`Unexpected Docker call: ${JSON.stringify(args)}`);
			}
			expect(args).toEqual(step.args);
			if (step.result instanceof Error) {
				throw step.result;
			}
			return step.result;
		},
	};
}
