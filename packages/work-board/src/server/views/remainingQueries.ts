import { Clock, Effect } from "effect";
import { Conflict } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { Diagnostics } from "#diagnostics/source.ts";
import { HandoffsService } from "#server/handoffs/Service.ts";
import { identityUrl } from "#server/metadata/links.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { startTemplates } from "#server/page/startTemplates.ts";
import { Workspace } from "#server/workspace.ts";
import { resultProjection } from "./resultProjection.ts";
export const remainingQueries = Effect.gen(function* () {
	const workspace = yield* Workspace;
	const { changes, writable } = yield* workspace.settings();
	const index = workspace.index();
	const read = workspace.document;
	const services = { diagnostics: yield* Diagnostics, handoffs: yield* HandoffsService };
	return {
		diagnostics: () =>
			Effect.gen(function* () {
				return { now: yield* Clock.currentTimeMillis, sources: yield* services.diagnostics.read() };
			}),
		handoff: (url: string) =>
			Effect.gen(function* () {
				const item = new URL(url, "http://127.0.0.1").searchParams.get("item") ?? "";
				const service = services.handoffs;
				const result = yield* Effect.result(service.locate(item));
				const source = result._tag === "Success" ? result.success : undefined;
				const parsed = metadataParse(source?.context ?? "");
				const title = /^#\s+(?<title>.+)$/mu.exec(parsed.body)?.groups?.title ?? item;
				return {
					background: parsed.body,
					goal: title,
					item,
					nextAction: parsed.fields.nextAction ?? "",
					owner: parsed.fields.owner,
					reading: yield* service.read(item),
					source,
					status: parsed.fields.status,
					title,
					unavailable: result._tag === "Failure" ? result.failure.message : undefined,
					writable: writable === true,
				};
			}),
		result: (url: string) =>
			Effect.gen(function* () {
				const item = resultItem(url);
				const data = yield* index;
				const matches = data.model.ids.get(item);
				const result = matches?.length === 1 ? matches[0] : undefined;
				if (result?.parsed.fields.kind !== "report" || data.unavailable.length > 0) {
					return yield* Effect.fail(
						new Conflict({
							message: "No single result has this ID. It may be missing, share its ID with another file, or sit in a file the Board can't read.",
						}),
					);
				}
				return yield* resultProjection(item, result, data, yield* read(identityUrl(item)));
			}),
		start: () => Effect.map(changes.files, (files) => ({ empty: files.length === 0, templates: startTemplates })),
	};
});

function resultItem(url: string) {
	const parsed = new URL(url, "http://127.0.0.1");
	const identity = /^\/_board\/item\/(?<id>[^/]+)\/?$/u.exec(parsed.pathname)?.groups?.id;
	return identity ? decodeURIComponent(identity) : (parsed.searchParams.get("item") ?? "");
}
