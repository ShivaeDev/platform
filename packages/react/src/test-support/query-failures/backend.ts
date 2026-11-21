import { Effect, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { AuthUnavailable, Conflict, InternalServerError, ServiceUnavailable, TooManyRequests } from "@shivaedev/errors/taxonomy.ts";
import { layerLiveMemoryProtocol } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";

export class ReportArchived extends Schema.TaggedError<ReportArchived>()("ReportArchived", { year: Schema.Number }) {}

const Report = Schema.Struct({ title: Schema.String });

// The report can fail with every class of failure a screen meets: shared rejections, the server's own failures and one the app declared.
export const Reports = contract("reports", {
	commands: [command("rename", { invalidates: () => [], payload: { title: Schema.String }, success: Report })],
	queries: [
		query("report", {
			readPolicy: () => Effect.succeed(true),
			reads: () => [],
			rejections: { AuthUnavailable, Conflict, InternalServerError, ReportArchived, ServiceUnavailable, TooManyRequests },
			success: Report,
		}),
	],
});

export type Answer =
	| "AuthUnavailable"
	| "Conflict"
	| "InternalServerError"
	| "ReportArchived"
	| "ServiceUnavailable"
	| "TooManyRequests"
	| "the report";

// A client-side read, such as one the app derives in the browser, can die or fail without a tag, which no server answer does.
export type LocalAnswer = "a defect" | "an untagged failure" | "the summary";

export interface ReportBackend {
	answers: Answer[];
	localAnswers: LocalAnswer[];
	reads: number;
	title: string;
}

function answer(backend: ReportBackend, next: Answer) {
	switch (next) {
		case "AuthUnavailable":
			return Effect.fail(new AuthUnavailable({ message: "Sign-in is unavailable right now" }));
		case "Conflict":
			return Effect.fail(new Conflict({ message: "The report changed while it was read" }));
		case "InternalServerError":
			return Effect.fail(new InternalServerError({ message: "The server could not read the report" }));
		case "ReportArchived":
			return Effect.fail(new ReportArchived({ year: 2024 }));
		case "ServiceUnavailable":
			return Effect.fail(new ServiceUnavailable({ message: "Reports are down for maintenance" }));
		case "TooManyRequests":
			return Effect.fail(new TooManyRequests({ message: "Too many reads. Wait a moment." }));
		case "the report":
			return Effect.succeed({ title: backend.title });
	}
}

export function archivedNotice(error: ReportArchived) {
	return { message: `The ${error.year} report is archived` };
}

export function summaryAtom(backend: ReportBackend) {
	return Atom.make(
		Effect.suspend(() => {
			const next = backend.localAnswers.shift() ?? "the summary";
			if (next === "a defect") {
				return Effect.die(new Error("Summary cache password rejected"));
			}
			return next === "an untagged failure" ? Effect.fail("summary unreadable") : Effect.succeed({ title: `${backend.title} summary` });
		}),
	);
}

export function reportProtocol(backend: ReportBackend) {
	const handlers = Reports.application.toLayer({
		"reports.rename": ({ title }) =>
			Effect.sync(() => {
				backend.title = title;
				return { title };
			}),
		"reports.report": () =>
			Effect.suspend(() => {
				backend.reads += 1;
				return answer(backend, backend.answers.shift() ?? "the report");
			}),
	});
	return layerLiveMemoryProtocol(Reports, handlers);
}
