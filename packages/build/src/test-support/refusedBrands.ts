// Operations of the refused module that return a brand, or a record keyed by one, in a form the wire cannot carry exactly.
export const REFUSED_BRANDS: Readonly<Record<string, string>> = {
	"src/modules/refused/branded.ts": `import { Brand, Schema } from "effect";

export type NoteId = number & Brand.Brand<"NoteId">;

export const noteId = Brand.nominal<NoteId>();

export const Shelf = Schema.String.pipe(Schema.brand("Shelf"));
export type Shelf = typeof Shelf.Type;

export type UserId = string & { readonly __brand: "UserId" };

export type Letter = ("a" | "b") & Brand.Brand<"Letter">;

export type Counts<K extends string> = { [P in K]: number };

export interface Box<K extends string> {
	readonly counts: { [P in K]: number };
}

export type LetterRecord = Record<Letter, number>;

export type NoKeys = Record<never, number>;
`,
	"src/modules/refused/brands.ts": `import { Effect } from "effect";
import { query } from "@shivaedev/contract/operation.ts";
import type { Record as EffectRecord } from "effect";
import {
	type Box,
	type Counts,
	type Letter,
	type LetterRecord,
	type NoKeys,
	type NoteId,
	noteId,
	type Shelf,
	type UserId,
} from "#modules/refused/branded.ts";
import { type Sku, shared } from "#modules/refused/shared.ts";

export const ReturnsBrand = query("returnsBrand", {
	reads: () => [shared.list],
	*run() {
		return noteId(yield* Effect.succeed(1));
	},
});

export const ReturnsTwiceBranded = query("returnsTwiceBranded", {
	reads: () => [shared.list],
	*run() {
		return yield* Effect.succeed("a" as Sku);
	},
});

export const ReturnsHandBranded = query("returnsHandBranded", {
	reads: () => [shared.list],
	*run() {
		return yield* Effect.succeed("a" as UserId);
	},
});

export const ReturnsNumberBrandKeys = query("returnsNumberBrandKeys", {
	reads: () => [shared.list],
	*run() {
		const titles: Record<NoteId, string> = yield* Effect.succeed({});
		return titles;
	},
});

export const ReturnsLiteralBrandKeys = query("returnsLiteralBrandKeys", {
	reads: () => [shared.list],
	*run() {
		return yield* Effect.succeed<Record<Letter, number>>({} as Record<Letter, number>);
	},
});

export const ReturnsReadonlyLiteralBrandKeys = query("returnsReadonlyLiteralBrandKeys", {
	reads: () => [shared.list],
	*run() {
		return yield* Effect.succeed<Readonly<Record<Letter | "c", number>>>({ c: 1 });
	},
});

export const ReturnsMappedLiteralBrandKeys = query("returnsMappedLiteralBrandKeys", {
	reads: () => [shared.list],
	*run() {
		const counts: { [L in Letter]: number } = yield* Effect.succeed({} as { [L in Letter]: number });
		return counts;
	},
});

export const ReturnsPartialMappedLiteralBrandKeys = query("returnsPartialMappedLiteralBrandKeys", {
	reads: () => [shared.list],
	*run() {
		const counts: Partial<{ [L in Letter]: number }> = yield* Effect.succeed({});
		return counts;
	},
});

export const ReturnsGenericMappedLiteralBrandKeys = query("returnsGenericMappedLiteralBrandKeys", {
	reads: () => [shared.list],
	*run() {
		const counts: Counts<Letter> = yield* Effect.succeed({} as Counts<Letter>);
		return counts;
	},
});

export const ReturnsMemberMappedLiteralBrandKeys = query("returnsMemberMappedLiteralBrandKeys", {
	reads: () => [shared.list],
	*run() {
		const counts: Box<Letter>["counts"] = yield* Effect.succeed({} as Box<Letter>["counts"]);
		return counts;
	},
});

export const ReturnsGenericMappedNever = query("returnsGenericMappedNever", {
	reads: () => [shared.list],
	*run() {
		const counts: Counts<never> = yield* Effect.succeed({});
		return counts;
	},
});

export const ReturnsEmptyOmit = query("returnsEmptyOmit", {
	reads: () => [shared.list],
	*run() {
		const rest: Omit<{ readonly a: number }, "a"> = yield* Effect.succeed({});
		return rest;
	},
});

export const ReturnsAliasedEmptyRecord = query("returnsAliasedEmptyRecord", {
	reads: () => [shared.list],
	*run() {
		const none: NoKeys = yield* Effect.succeed({});
		return none;
	},
});

export const ReturnsEmptyReadonlyRecord = query("returnsEmptyReadonlyRecord", {
	reads: () => [shared.list],
	*run() {
		const none: EffectRecord.ReadonlyRecord<never, number> = yield* Effect.succeed({});
		return none;
	},
});

export const ReturnsAliasedLiteralBrandRecord = query("returnsAliasedLiteralBrandRecord", {
	reads: () => [shared.list],
	*run() {
		const counts: LetterRecord = yield* Effect.succeed({} as LetterRecord);
		return counts;
	},
});

export const ReturnsPartialRecord = query("returnsPartialRecord", {
	reads: () => [shared.list],
	*run() {
		const counts: Partial<Record<Shelf, number>> = yield* Effect.succeed({});
		return counts;
	},
});
`,
};
