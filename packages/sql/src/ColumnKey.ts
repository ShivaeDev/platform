import { Config, ConfigProvider, Context, Data, Effect, Layer, Redacted, Result } from "effect";
import { Aead } from "effect/crypto";
import * as Base64 from "effect/encoding/Base64";

export const COLUMN_KEY_CONFIG = "COLUMN_ENCRYPTION_KEY";

export type ColumnKeyAlgorithm = typeof Aead.xchacha20Poly1305;

export class ColumnKeyError extends Data.TaggedError("ColumnKeyError")<{
	readonly config: string;
	readonly reason: "malformed" | "missing";
}> {
	override get message() {
		return this.reason === "missing"
			? `${this.config} is not set; encrypted fields need it to hold 32 random bytes in base64`
			: `${this.config} must hold exactly 32 bytes in base64`;
	}
}

const configuredKey = Effect.gen(function* () {
	const missing = new ColumnKeyError({ config: COLUMN_KEY_CONFIG, reason: "missing" });
	const malformed = new ColumnKeyError({ config: COLUMN_KEY_CONFIG, reason: "malformed" });
	const text = yield* Effect.mapError(Config.Redacted(COLUMN_KEY_CONFIG), () => missing);
	const bytes = Base64.decode(Redacted.value(text).trim());
	if (Result.isFailure(bytes)) {
		return yield* malformed;
	}
	return yield* Effect.mapError(Aead.key(Aead.xchacha20Poly1305, bytes.success), () => malformed);
});

// The service holds the key's loading rather than the key, so a process whose repositories never seal or open a value never reads the config.
export class ColumnKey extends Context.Service<ColumnKey, Effect.Effect<Aead.Key<ColumnKeyAlgorithm>, ColumnKeyError>>()("@shivaedev/sql/ColumnKey") {
	static readonly fromConfig = Layer.effect(ColumnKey)(
		Effect.gen(function* () {
			const provider = yield* ConfigProvider.ConfigProvider;
			return yield* Effect.cached(Effect.provideService(configuredKey, ConfigProvider.ConfigProvider, provider));
		}),
	);
}
