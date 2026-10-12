import { Effect, Schema } from "effect";
import { GithubLimits, SourceFailure } from "#diagnostics/source.ts";
import { readCommand } from "./readCommand.ts";

const Response = Schema.Struct({ resources: GithubLimits });

export function githubLimits(read = readCommand("gh", ["api", "rate_limit"])) {
	return read.pipe(
		Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(Response))),
		Effect.map(({ resources }) => resources),
		Effect.mapError((error) =>
			error instanceof SourceFailure ? error : new SourceFailure({ kind: "error", message: "GitHub returned invalid rate limits" }),
		),
	);
}
