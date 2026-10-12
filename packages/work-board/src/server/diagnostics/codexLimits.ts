import { Effect, Schema } from "effect";
import { CodexLimits, SourceFailure } from "#diagnostics/source.ts";
import { codexRateLimits } from "./codexRateLimits.ts";

const Response = Schema.Struct({ rateLimits: CodexLimits });

export function codexLimits(read = codexRateLimits()) {
	return read.pipe(
		Effect.flatMap(Schema.decodeUnknownEffect(Response)),
		Effect.map(({ rateLimits }) => rateLimits),
		Effect.mapError((error) =>
			error instanceof SourceFailure ? error : new SourceFailure({ kind: "error", message: "Codex returned invalid usage windows" }),
		),
	);
}
