// A module whose every operation needs something the wire cannot carry exactly, each written the way an application might.
export const REFUSING_PROJECT: Readonly<Record<string, string>> = {
	"src/modules/refused/operations.ts": `import { Effect, Schema } from "effect";
import { query } from "@shivaedev/contract/operation.ts";
import { RefusedDraft } from "./payloads.ts";
import { Busy, Counter, Level, shared, type Tree } from "#modules/refused/shared.ts";

class Hidden extends Schema.TaggedError<Hidden>()("Hidden", { message: Schema.String }) {}

class Secret extends Schema.Class<Secret>("Secret")({ code: Schema.String }) {}

const Draft = Schema.Struct({ title: Schema.String });

const loose: { readonly summary?: string | undefined } = {};

const unset: { readonly summary: string | undefined } = { summary: undefined };

export const ReturnsMap = query("returnsMap", {
	reads: () => [shared.list],
	*run() {
		yield* Effect.void;
		return new Map<string, number>();
	},
});

export const ReturnsStringOrNumber = query("returnsStringOrNumber", {
	reads: () => [shared.list],
	*run() {
		const count = yield* Effect.succeed(1);
		return count > 0 ? String(count) : count;
	},
});

export const ReturnsLooseOptional = query("returnsLooseOptional", {
	reads: () => [shared.list],
	*run() {
		yield* Effect.void;
		return loose;
	},
});

export const ReturnsUndefinedProperty = query("returnsUndefinedProperty", {
	reads: () => [shared.list],
	*run() {
		yield* Effect.void;
		return unset;
	},
});

export const ReturnsNullOrUndefined = query("returnsNullOrUndefined", {
	reads: () => [shared.list],
	*run() {
		const count = yield* Effect.succeed(1);
		return count > 0 ? null : undefined;
	},
});

export const ReturnsAny = query("returnsAny", {
	reads: () => [shared.list],
	*run() {
		yield* Effect.void;
		return JSON.parse("{}");
	},
});

export const ReturnsPlainClass = query("returnsPlainClass", {
	reads: () => [shared.list],
	*run() {
		yield* Effect.void;
		return new Counter(1);
	},
});

export const ReturnsEnum = query("returnsEnum", {
	reads: () => [shared.list],
	*run() {
		const level: Level = yield* Effect.succeed(Level.High);
		return { level };
	},
});

export const ReturnsUnknown = query("returnsUnknown", {
	reads: () => [shared.list],
	*run() {
		const value: unknown = yield* Effect.succeed(1);
		return value;
	},
});

export const ReturnsStringOrBigint = query("returnsStringOrBigint", {
	reads: () => [shared.list],
	*run() {
		const count = yield* Effect.succeed(1n);
		return count > 0n ? String(count) : count;
	},
});

export const ReturnsRecursive = query("returnsRecursive", {
	reads: () => [shared.list],
	*run() {
		const tree: Tree = yield* Effect.succeed({ children: [] });
		return tree;
	},
});

export const ReturnsTupleRest = query("returnsTupleRest", {
	reads: () => [shared.list],
	*run() {
		const row: readonly [string, ...number[]] = yield* Effect.succeed(["total", 1, 2] as const);
		return row;
	},
});

export const ReturnsNumberKeys = query("returnsNumberKeys", {
	reads: () => [shared.list],
	*run() {
		const titles: Record<number, string> = yield* Effect.succeed({});
		return titles;
	},
});

export const ReturnsUnexportedClass = query("returnsUnexportedClass", {
	reads: () => [shared.list],
	*run() {
		yield* Effect.void;
		return new Secret({ code: "x" });
	},
});

export const FailsDataTagged = query("failsDataTagged", {
	reads: () => [shared.list],
	*run() {
		yield* new Busy({ message: "busy" });
		return 1;
	},
});

export const FailsUntagged = query("failsUntagged", {
	reads: () => [shared.list],
	*run() {
		yield* Effect.fail("no");
		return 1;
	},
});

export const FailsUnexported = query("failsUnexported", {
	reads: () => [shared.list],
	*run() {
		yield* new Hidden({ message: "hidden" });
		return 1;
	},
});

export const LocalPayload = query("localPayload", {
	payload: Draft,
	reads: () => [shared.list],
	*run({ title }) {
		return yield* Effect.succeed(title);
	},
});

export const RelativePayload = query("relativePayload", {
	payload: RefusedDraft,
	reads: () => [shared.list],
	*run({ body }) {
		return yield* Effect.succeed(body);
	},
});
`,
	"src/modules/refused/payloads.ts": `import { Schema } from "effect";

export const RefusedDraft = Schema.Struct({ body: Schema.String });

export const SkuCode = Schema.String.pipe(Schema.brand("Sku"));
`,
	"src/modules/refused/refused.ts": `import { defineModule } from "@shivaedev/contract/defineModule.ts";
import {
	ReturnsAliasedEmptyRecord,
	ReturnsAliasedLiteralBrandRecord,
	ReturnsBrand,
	ReturnsEmptyOmit,
	ReturnsEmptyReadonlyRecord,
	ReturnsGenericMappedLiteralBrandKeys,
	ReturnsGenericMappedNever,
	ReturnsHandBranded,
	ReturnsLiteralBrandKeys,
	ReturnsMappedLiteralBrandKeys,
	ReturnsMemberMappedLiteralBrandKeys,
	ReturnsNumberBrandKeys,
	ReturnsPartialMappedLiteralBrandKeys,
	ReturnsPartialRecord,
	ReturnsReadonlyLiteralBrandKeys,
	ReturnsTwiceBranded,
} from "#modules/refused/brands.ts";
import {
	FailsDataTagged,
	FailsUnexported,
	FailsUntagged,
	LocalPayload,
	RelativePayload,
	ReturnsAny,
	ReturnsEnum,
	ReturnsLooseOptional,
	ReturnsMap,
	ReturnsNullOrUndefined,
	ReturnsNumberKeys,
	ReturnsPlainClass,
	ReturnsRecursive,
	ReturnsStringOrBigint,
	ReturnsStringOrNumber,
	ReturnsTupleRest,
	ReturnsUndefinedProperty,
	ReturnsUnexportedClass,
	ReturnsUnknown,
} from "#modules/refused/operations.ts";

export const Refused = defineModule({
	name: "refused",
	operations: [
		ReturnsMap,
		ReturnsStringOrNumber,
		ReturnsLooseOptional,
		ReturnsUndefinedProperty,
		ReturnsNullOrUndefined,
		ReturnsAny,
		ReturnsPlainClass,
		ReturnsEnum,
		ReturnsBrand,
		ReturnsTwiceBranded,
		ReturnsHandBranded,
		ReturnsNumberBrandKeys,
		ReturnsLiteralBrandKeys,
		ReturnsReadonlyLiteralBrandKeys,
		ReturnsMappedLiteralBrandKeys,
		ReturnsPartialMappedLiteralBrandKeys,
		ReturnsGenericMappedLiteralBrandKeys,
		ReturnsMemberMappedLiteralBrandKeys,
		ReturnsGenericMappedNever,
		ReturnsAliasedLiteralBrandRecord,
		ReturnsEmptyOmit,
		ReturnsAliasedEmptyRecord,
		ReturnsEmptyReadonlyRecord,
		ReturnsPartialRecord,
		ReturnsUnknown,
		ReturnsStringOrBigint,
		ReturnsRecursive,
		ReturnsTupleRest,
		ReturnsNumberKeys,
		ReturnsUnexportedClass,
		FailsUntagged,
		FailsUnexported,
		FailsDataTagged,
		LocalPayload,
		RelativePayload,
	],
	wire: {},
});
`,
	"src/modules/refused/shared.ts": `import { Data, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";

export const shared = collection("shared", Schema.Number);

export enum Level {
	Low,
	High,
}

export const Sku = Schema.String.pipe(Schema.brand("Sku"));
export type Sku = typeof Sku.Type;

export interface Tree {
	readonly children: readonly Tree[];
}

export class Busy extends Data.TaggedError("Busy")<{ readonly message: string }> {}

export class Counter {
	readonly count: number;

	constructor(count: number) {
		this.count = count;
	}
}
`,
	"tsconfig.json": `{
	"compilerOptions": { "customConditions": ["@shivaedev/source"], "types": [] },
	"extends": "@shivaedev/quality/tsconfig/base.json",
	"include": ["src", "lib"]
}
`,
};
