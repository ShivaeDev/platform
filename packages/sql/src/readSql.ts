import { Data, Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { type Composite, type CompositeBucketKey, type CompositeItemKey, isComposite } from "@shivaedev/changes/compositeKeys.ts";
import { type BucketKey, type ItemKey, Key, recordKey } from "@shivaedev/changes/keys.ts";
import { recordRead } from "@shivaedev/changes/readRecorder.ts";

export class MultiColumnKeyParameter extends Data.TaggedError("MultiColumnKeyParameter")<{
	readonly key: CompositeBucketKey | CompositeItemKey;
}> {
	override get message() {
		const named =
			this.key._tag === "Bucket"
				? `the tuple bucket ${this.key.collection}.${this.key.field} ${this.key.value}`
				: `the composite row ${recordKey(this.key.collection, this.key.id)}`;
		return `readSql cannot bind ${named} as one parameter, because it spans several columns. Bind each column's value and declare the key in the query's reads.`;
	}
}

type Refused<TArgs extends readonly unknown[]> = {
	readonly [TIndex in keyof TArgs]: TArgs[TIndex] extends { readonly [Composite]: true }
		? "A tuple bucket or composite row key spans several columns, so it cannot be one parameter"
		: TArgs[TIndex];
};

const isKey = Schema.is(Key);

function isReadKey(value: unknown): value is BucketKey | ItemKey {
	return isKey(value) && value._tag !== "List";
}

function bound(value: unknown) {
	if (!isReadKey(value)) {
		return value;
	}
	return value._tag === "Bucket" ? value.value : value.id;
}

const readMarked = Effect.fn("Sql.readMarked")(function* (strings: TemplateStringsArray, args: readonly unknown[]) {
	const keys = args.filter(isReadKey);
	const multiColumn = keys.find(isComposite);
	if (multiColumn !== undefined) {
		return yield* new MultiColumnKeyParameter({ key: multiColumn });
	}
	const sql = yield* SqlClient.SqlClient;
	yield* recordRead(keys, { inferred: true });
	return yield* sql(strings, ...args.map(bound));
});

export function readSql<const TArgs extends readonly unknown[]>(strings: TemplateStringsArray, ...args: TArgs & Refused<TArgs>) {
	return readMarked(strings, args);
}
