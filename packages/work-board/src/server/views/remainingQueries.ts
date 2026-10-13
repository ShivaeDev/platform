import { Clock, Effect } from "effect";
import { Conflict, NotFound } from "@shivaedev/platform/errors/taxonomy.ts";
import type { Diagnostics } from "#diagnostics/source.ts";
import type { HandoffsService } from "#server/handoffs/Service.ts";
import { identityUrl } from "#server/metadata/links.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { startTemplates } from "#server/page/startTemplates.ts";
import type { Responses } from "#server/responses/service.ts";
import type { ServerOptions } from "#server/rpc/transport.ts";
import { resultProjection } from "./resultProjection.ts";
export function remainingQueries(
	{ changes, document, index, writable }: ServerOptions,
	services: {
		readonly diagnostics: typeof Diagnostics.Service;
		readonly responses: typeof Responses.Service;
		readonly handoffs: typeof HandoffsService.Service;
	},
) {
	function read(url: string) {
		return document ? document(url) : Effect.fail(new NotFound({ message: "The document is missing." }));
	}
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
				return {
					background: parsed.body,
					goal: /^#\s+(?<title>.+)$/mu.exec(parsed.body)?.groups?.title ?? item,
					item,
					nextAction: parsed.fields.nextAction ?? "",
					reading: yield* service.read(item),
					source,
					unavailable: result._tag === "Failure" ? String(result.failure) : undefined,
					writable: writable === true,
				};
			}),
		respond: (url: string) =>
			Effect.gen(function* () {
				const params = new URL(url, "http://127.0.0.1").searchParams;
				const service = services.responses;
				const preview = yield* service.locate(params.get("item") ?? "", params.get("request") ?? "");
				yield* service.read(preview.id).pipe(Effect.catch((error) => (error._tag === "NotFound" ? Effect.void : Effect.fail(error))));
				const responses = yield* service.history(preview);
				const data = yield* read(identityUrl(preview.item));
				const request = data.requests.find((entry) => entry.id === preview.request);
				if (!request) {
					return yield* Effect.fail(new Conflict({ message: "The response request is unavailable." }));
				}
				return { document: data, request: { ...request, preview, responses } };
			}),
		result: (url: string) =>
			Effect.gen(function* () {
				const item = new URL(url, "http://127.0.0.1").searchParams.get("item") ?? "";
				const data = yield* index;
				const matches = data.model.ids.get(item);
				const result = matches?.length === 1 ? matches[0] : undefined;
				if (result?.parsed.fields.kind !== "result" || data.unavailable.length > 0) {
					return yield* Effect.fail(
						new Conflict({ message: "Choose one uniquely identified, readable result. Missing or ambiguous work is not accepted." }),
					);
				}
				return yield* resultProjection(result, data, yield* read(identityUrl(item)));
			}),
		start: () => Effect.map(changes.files, (files) => ({ empty: files.length === 0, templates: startTemplates })),
	};
}
