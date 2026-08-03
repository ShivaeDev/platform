import type { TestContext, Vitest } from "@effect/vitest";
import type {
	AnyDatabase,
	DatabaseRequirement,
	DatabaseService,
} from "@shivaedev/effect-prisma/testing";
import type { EffectTRPCAdapter } from "@shivaedev/effect-trpc";
import type {
	CallerOptions,
	CallerResult,
	EffectCallerFactory,
	TrpcHarnessTest,
	TrpcHarnessTester,
} from "@shivaedev/effect-trpc/testing";
import type { Effect, Layer } from "effect";

export type PlatformHarness<
	Database extends AnyDatabase,
	Options,
	Caller,
	Extension,
> = Readonly<{
	db: DatabaseService<Database>;
	trpc: EffectCallerFactory<Options, Caller>;
}> &
	Readonly<{
		promise: <Value>(
			evaluate: () => Promise<Value>,
		) => Effect.Effect<Value, unknown>;
	}> &
	Omit<Extension, "db" | "promise" | "trpc">;

export type PlatformTest<Harness, Provided> = TrpcHarnessTest<
	Harness,
	Provided
>;

export type PlatformTester<Harness, Provided> = TrpcHarnessTester<
	Harness,
	Provided
>;

export type PlatformIt<Harness, Provided> = Vitest.Methods & {
	readonly effectApp: PlatformTester<Harness, Provided>;
};

export interface MakePlatformItOptions<
	Database extends AnyDatabase,
	CreateCaller extends (...arguments_: never[]) => object,
	Provided,
	LayerError,
	Extension,
> {
	readonly adapter: Pick<EffectTRPCAdapter<never>, "runWithServices">;
	readonly createCaller: CreateCaller;
	readonly extend?: (
		base: Readonly<{
			db: DatabaseService<Database>;
			trpc: EffectCallerFactory<
				CallerOptions<NoInfer<CreateCaller>>,
				CallerResult<NoInfer<CreateCaller>>
			>;
		}>,
		context: TestContext,
	) => Effect.Effect<
		Extension,
		unknown,
		Provided | DatabaseRequirement<Database> | Effect.Services<Database>
	>;
	readonly layer: Layer.Layer<Provided, LayerError>;
}
