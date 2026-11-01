import { inspect } from "node:util";
import { Effect, ErrorReporter, Schema } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { redactingErrorReporter } from "#redactCause.ts";

const Profile = Schema.Struct({ profile: Schema.Struct({ ages: Schema.Array(Schema.Number) }) });
interface Report {
	readonly details: string;
	readonly message: string;
	readonly stack: string | undefined;
}

export const schemaReporting = storyKit({
	create: () => {
		const reports: Report[] = [];
		const reporter = redactingErrorReporter(
			ErrorReporter.make(({ cause, error }) => {
				reports.push({ details: inspect(cause, { depth: null }), message: error.message, stack: error.stack });
			}),
		);
		return { layer: ErrorReporter.layer([reporter]), reports };
	},
	name: "schema failure reporting",
	stages: [],
	verbs: (state, story) => ({
		recordedReports: () => Effect.sync(() => [...state.reports]),
		submitAges: (ages: readonly unknown[], kind: "failure" | "defect") => {
			story.tell(`alice submits ages that fail decoding as a ${kind}`);
			const decode = Schema.decodeUnknownEffect(Profile, { errors: "all", reportInput: true })({ profile: { ages } });
			return (kind === "defect" ? Effect.orDie(decode) : decode).pipe(
				Effect.catchCause(ErrorReporter.report),
				Effect.provide(state.layer),
				Effect.asVoid,
			);
		},
	}),
});
