import { Data, Effect, Redacted } from "effect";

export class NonLocalSeedDatabase extends Data.TaggedError("NonLocalSeedDatabase") {
	override readonly message = "Demo seeding requires a local PostgreSQL database URL";
}

export const assertSeedDatabase = Effect.fnUntraced(function* (value: Redacted.Redacted<string>) {
	const url = yield* Effect.try({ catch: () => new NonLocalSeedDatabase(), try: () => new URL(Redacted.value(value)) });
	if (
		!(["postgres:", "postgresql:"].includes(url.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
		|| [...url.searchParams.keys()].some((key) => ["host", "hostaddr", "service"].includes(key.toLowerCase()))
	) {
		return yield* new NonLocalSeedDatabase();
	}
});
