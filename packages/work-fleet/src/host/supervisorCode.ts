import { Effect } from "effect";
import { installedCode } from "#host/adapters/installedCode.ts";

export interface RunningCode {
	readonly entry: string;
	readonly manifest: string;
	readonly revision: string;
}

export const codeReader = Effect.fn("FleetSupervisor.codeReader")(function* (boardDir: string) {
	return yield* Effect.try({ catch: (cause) => new Error(`Cannot read installed Fleet code: ${cause}`), try: () => installedCode(boardDir) });
});
