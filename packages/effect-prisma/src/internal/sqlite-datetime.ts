import type { ExecutionContext } from "@prisma-next/sql-runtime";
import type { AnySqlContract } from "./executor.ts";

type CodecRegistry = ExecutionContext<AnySqlContract>["contractCodecs"];
type ContractCodec = ReturnType<CodecRegistry["forCodecRef"]>;
type CodecWire = Parameters<ContractCodec["decode"]>[0];
type CodecJson = Parameters<ContractCodec["decodeJson"]>[0];

const sqliteDatetimeCodecId = "sqlite/datetime@1";

const zonelessDatetime = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)$/;

// SQLite computes `datetime('now')`, the default `prisma-next db init` generates, in UTC but writes it as `YYYY-MM-DD HH:MM:SS`
// with no zone, and `new Date` reads that form as local time. Values with a zone and date-only values already read as UTC.
export const normalizeSqliteDatetime = (value: string): string => value.replace(zonelessDatetime, "$1T$2Z");

const decodeAsUtc = (codec: ContractCodec): ContractCodec => ({
	decode: (wire: CodecWire, context) => codec.decode(typeof wire === "string" ? normalizeSqliteDatetime(wire) : wire, context),
	decodeJson: (json: CodecJson) => codec.decodeJson(typeof json === "string" ? normalizeSqliteDatetime(json) : json),
	encode: (value, context) => codec.encode(value, context),
	encodeJson: (value) => codec.encodeJson(value),
	id: sqliteDatetimeCodecId,
});

// The registry resolves codecs for rows and included relations alike, and Prisma Next rejects a second descriptor for a registered
// codec id, so wrapping the registry is the one way to cover every read. It must run before the first query, which reads the
// registry off the context. Codecs are matched by reference because a materialized codec's `id` accessor throws.
export const decodeSqliteDatetimesAsUtc = (context: ExecutionContext<AnySqlContract>): void => {
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
		forCodecRef: (reference) => {
			const codec = registry.forCodecRef(reference);
			return reference.codecId === sqliteDatetimeCodecId ? wrap(codec) : codec;
		},
		forColumn: (namespaceId, table, column) => {
			const codec = registry.forColumn(namespaceId, table, column);
			if (codec === undefined) {
				return undefined;
			}
			const reference = descriptors.codecRefForColumn(namespaceId, table, column);
			return reference?.codecId === sqliteDatetimeCodecId ? wrap(codec) : codec;
		},
	};

	if (!Reflect.set(context, "contractCodecs", utcRegistry)) {
		throw new TypeError("The SQLite execution context does not accept a codec registry");
	}
};
