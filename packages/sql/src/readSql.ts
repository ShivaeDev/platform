import { Data, Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { Row } from "effect/sql/SqlConnection";
import type { SqlError } from "effect/sql/SqlError";
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

type MayBindMultiColumn<TArg> = 0 extends 1 & TArg ? true : unknown extends TArg ? true : TArg extends unknown ? MemberMayBind<TArg> : never;

// Only the single-column key types carry the mark's key, so a plain key type may hide a composite.
type MemberMayBind<TMember> = typeof Composite extends keyof TMember
	? TMember extends { readonly [Composite]?: infer TMark }
		? [TMark] extends [false | undefined]
			? false
			: true
		: true
	: TMember extends { readonly _tag: infer TTag }
		? "Bucket" extends TTag
			? true
			: "Item" extends TTag
				? true
				: false
		: BucketKey extends TMember
			? true
			: ItemKey extends TMember
				? true
				: false;

type SingleColumn<TArgs extends readonly unknown[]> = {
	readonly [TIndex in keyof TArgs]: true extends MayBindMultiColumn<TArgs[TIndex]> ? never : TArgs[TIndex];
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

export function readSql<const TArgs extends readonly unknown[]>(
	strings: TemplateStringsArray,
	...args: TArgs & SingleColumn<TArgs>
): Effect.Effect<readonly Row[], SqlError, SqlClient.SqlClient>;
export function readSql<const TArgs extends readonly unknown[]>(
	strings: TemplateStringsArray,
	...args: TArgs & Refused<TArgs>
): Effect.Effect<readonly Row[], SqlError | MultiColumnKeyParameter, SqlClient.SqlClient>;
export function readSql(strings: TemplateStringsArray, ...args: readonly unknown[]) {
	return readMarked(strings, args);
}
