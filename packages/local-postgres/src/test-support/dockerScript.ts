import { isDeepStrictEqual } from "node:util";

export const PINNED_IMAGE = "postgres:18.6-alpine@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873";

export function dockerScript(steps: readonly { readonly args: readonly string[]; readonly result: string | Error }[]) {
	const remaining = [...steps];
	return {
		run(args: readonly string[]) {
			const step = remaining.shift();
			if (!(step && isDeepStrictEqual(step.args, args))) {
				throw new Error(`Unexpected Docker call: ${JSON.stringify(args)}; expected ${JSON.stringify(step?.args) ?? "no further command"}`);
			}
			return step.result;
		},
	};
}
