import type { ExecutionContext } from "@prisma-next/sql-runtime";
import type { AnySqlContract } from "./executor.js";

type CodecRegistry = ExecutionContext<AnySqlContract>["contractCodecs"];
type ContractCodec = ReturnType<CodecRegistry["forCodecRef"]>;
type CodecWire = Parameters<ContractCodec["decode"]>[0];
type CodecJson = Parameters<ContractCodec["decodeJson"]>[0];

const sqliteDatetimeCodecId = "sqlite/datetime@1";

const zonelessDatetime =
	/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)$/;

/**
 * Stamp `Z` onto a SQLite datetime string that carries no zone designator.
 *
 * SQLite stores `DateTime` as text and computes `datetime('now')` — the default
 * `prisma-next db init` generates — in UTC, but writes it as
 * `YYYY-MM-DD HH:MM:SS` with no zone. `new Date` reads that form as local time,
 * so decoding it unchanged shifts the instant by the process' UTC offset.
 * Values that already carry `Z` or a numeric offset, date-only values (which
 * `new Date` already reads as UTC), and anything that is not a datetime string
 * are returned unchanged.
 */
export const normalizeSqliteDatetime = (value: string): string =>
	value.replace(zonelessDatetime, "$1T$2Z");

const decodeAsUtc = (codec: ContractCodec): ContractCodec => ({
	id: sqliteDatetimeCodecId,
	encode: (value, context) => codec.encode(value, context),
	decode: (wire: CodecWire, context) =>
		codec.decode(
			typeof wire === "string" ? normalizeSqliteDatetime(wire) : wire,
			context,
		),
	encodeJson: (value) => codec.encodeJson(value),
	decodeJson: (json: CodecJson) =>
		codec.decodeJson(
			typeof json === "string" ? normalizeSqliteDatetime(json) : json,
		),
});

/**
 * Replace the client's codec registry with one that decodes zone-less
 * `sqlite/datetime@1` values as UTC.
 *
 * The registry is the single resolution point for both row decoding and the
 * JSON decoding of included relations, so wrapping it covers every read path
 * without touching encoding. Prisma Next rejects a second descriptor for an
 * already-registered codec id, so an extension pack cannot replace the codec
 * itself. Must run before the first query, because the runtime reads the
 * registry off the context when it is created.
 *
 * Codecs are identified by the resolved reference rather than by `codec.id`:
 * Prisma Next materializes a codec through an unbound descriptor factory, so
 * the instance's `id` accessor throws.
 */
export const decodeSqliteDatetimesAsUtc = (
	context: ExecutionContext<AnySqlContract>,
): void => {
	const registry = context.contractCodecs;
	const descriptors = context.codecDescriptors;
	const utcCodecs = new WeakMap<ContractCodec, ContractCodec>();

	const wrap = (codec: ContractCodec): ContractCodec => {
		const existing = utcCodecs.get(codec);
		if (existing !== undefined) {
			return existing;
		}
		const utc = decodeAsUtc(codec);
		utcCodecs.set(codec, utc);
		return utc;
	};

	const utcRegistry: CodecRegistry = {
		forColumn: (namespaceId, table, column) => {
			const codec = registry.forColumn(namespaceId, table, column);
			if (codec === undefined) {
				return undefined;
			}
			const reference = descriptors.codecRefForColumn(
				namespaceId,
				table,
				column,
			);
			return reference?.codecId === sqliteDatetimeCodecId ? wrap(codec) : codec;
		},
		forCodecRef: (reference) => {
			const codec = registry.forCodecRef(reference);
			return reference.codecId === sqliteDatetimeCodecId ? wrap(codec) : codec;
		},
	};

	(context as { contractCodecs: CodecRegistry }).contractCodecs = utcRegistry;
};
