// A module whose every operation needs something the wire cannot carry exactly, each written the way an application might.
export const REFUSING_PROJECT: Readonly<Record<string, string>> = {
	"lib/outside.ts": `import { defineModule } from "@shivaedev/contract/defineModule.ts";

export const Outside = defineModule({ name: "outside", operations: [], requires: [] });
`,
	"src/modules/refused/hidden.ts": `import { defineModule } from "@shivaedev/contract/defineModule.ts";

const Hidden = defineModule({ name: "hidden", operations: [], requires: [] });
`,
	"src/modules/refused/keys.ts": `import { Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";

export const refusedKeys = collection("refused", Schema.Number);
`,
	"src/modules/refused/operations.ts": `import { Effect, Schema } from "effect";
import { query } from "@shivaedev/contract/operation.ts";
import { refusedKeys } from "./keys.ts";
import { Counter, shared } from "#modules/refused/shared.ts";

class Hidden extends Schema.TaggedError<Hidden>()("Hidden", { message: Schema.String }) {}

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

export const RelativeReads = query("relativeReads", {
	reads: () => [refusedKeys.list],
	*run() {
		return yield* Effect.succeed(1);
	},
});
`,
	"src/modules/refused/refused.ts": `import { defineModule } from "@shivaedev/contract/defineModule.ts";
import {
	FailsUnexported,
	FailsUntagged,
	LocalPayload,
	RelativeReads,
	ReturnsAny,
	ReturnsLooseOptional,
	ReturnsMap,
	ReturnsNullOrUndefined,
	ReturnsPlainClass,
	ReturnsStringOrNumber,
	ReturnsUndefinedProperty,
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
		FailsUntagged,
		FailsUnexported,
		LocalPayload,
		RelativeReads,
	],
	requires: [],
});
`,
	"src/modules/refused/shared.ts": `import { Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";

export const shared = collection("shared", Schema.Number);

export class Counter {
	readonly count: number;

	constructor(count: number) {
		this.count = count;
	}
}
`,
	"src/modules/refused/twice.ts": `import { defineModule } from "@shivaedev/contract/defineModule.ts";

export const First = defineModule({ name: "first", operations: [], requires: [] });
export const Second = defineModule({ name: "second", operations: [], requires: [] });
`,
	"tsconfig.json": `{
	"compilerOptions": { "customConditions": ["@shivaedev/source"], "types": [] },
	"extends": "@shivaedev/quality/tsconfig/base.json",
	"include": ["src", "lib"]
}
`,
};
