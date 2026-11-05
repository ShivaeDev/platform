import { Effect } from "effect";
import { Codex } from "#codex/service.ts";

export const configuredBackend = Effect.fn("Codex.configuredBackend")(function* () {
	const codex = yield* Codex;
	return yield* codex.backend();
});
