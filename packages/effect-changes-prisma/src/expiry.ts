import { Clock, Context, Deferred, Effect, Option, Predicate, Schema } from "effect";
import { TransactionExpired } from "./error.ts";

export type Expire = (cause: unknown) => Effect.Effect<void>;

export const unlinked: Expire = () => Effect.void;

export const makeExpiry = (key: string) => Context.Reference<Expire>(key, { defaultValue: () => unlinked });

export const isTransactionClient = (client: object): boolean => !Predicate.hasProperty(client, "$connect");

export const isTransactionClosed = (cause: unknown): boolean => Predicate.hasProperty(cause, "code") && cause.code === "P2028";

const EngineConfig = Schema.Struct({ transactionOptions: Schema.Struct({ timeout: Schema.Number }) });

const decodeEngineConfig = Schema.decodeUnknownOption(EngineConfig);

export const configuredTimeout = (client: object): number | undefined =>
	Predicate.hasProperty(client, "_engineConfig")
		? Option.getOrUndefined(Option.map(decodeEngineConfig(client._engineConfig), (config) => config.transactionOptions.timeout))
		: undefined;

const wallClock = Clock.Clock.defaultValue();

export const expiring = <X, E, R>(
	body: Effect.Effect<X, E, R>,
	timeout: number | undefined,
	Expiry: Context.Reference<Expire>,
): Effect.Effect<X, E | TransactionExpired, R> =>
	Effect.gen(function* () {
		const outer = yield* Expiry;
		const expired = yield* Deferred.make<never, TransactionExpired>();
		const closed: Expire = (cause) =>
			Effect.andThen(
				Deferred.fail(expired, new TransactionExpired({ message: "The transaction was closed before its body finished", cause })),
				outer(cause),
			);
		const deadline =
			timeout === undefined
				? Effect.never
				: Effect.andThen(
						Effect.provideService(Effect.sleep(timeout), Clock.Clock, wallClock),
						Deferred.fail(expired, new TransactionExpired({ message: `The transaction expired after its ${timeout} ms timeout` })),
					);
		const guard = Effect.andThen(Effect.raceFirst(deadline, Deferred.await(expired)), Deferred.await(expired));
		return yield* Effect.raceFirst(Effect.provideService(body, Expiry, closed), guard).pipe(
			Effect.catchCause((cause) => Effect.flatMap(Deferred.isDone(expired), (done) => (done ? Deferred.await(expired) : Effect.failCause(cause)))),
		);
	});
