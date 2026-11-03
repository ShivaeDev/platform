import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { makePublication } from "#server/adapters/makePublication.ts";

export interface PublicationInput {
	readonly content: string | Uint8Array;
	readonly path: string;
	readonly realRoot: string;
	readonly root: string;
}

export interface ReplacementInput extends PublicationInput {
	readonly expectedSource: string;
}

export const Publication = defineService({
	id: "@shivaedev/work-board/Publication",
	initialize: makePublication,
	methods: (publication) => publication,
	requires: [],
});
export type Publication = typeof Publication.Identifier;

export const publishOnce = Effect.fn("WorkBoard.publishOnce")(function* (input: PublicationInput) {
	return yield* (yield* Publication).publishOnce(input);
});

export const replaceIfUnchanged = Effect.fn("WorkBoard.replaceIfUnchanged")(function* (input: ReplacementInput) {
	return yield* (yield* Publication).replaceIfUnchanged(input);
});
