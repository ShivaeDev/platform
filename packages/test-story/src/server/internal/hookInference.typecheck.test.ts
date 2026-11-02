import { Context, Data, Effect, Layer } from "effect";
import { expectTypeOf, it } from "vitest";
import { type StoryKit, storyKit, type Trait } from "#storyKit.ts";

class Count extends Context.Service<Count, number>()("effectHooks/Count") {}
class Missing extends Context.Service<Missing, number>()("effectHooks/Missing") {}
class Stuck extends Data.TaggedError("Stuck") {}

interface Engine {
	count: number;
}

const kit = storyKit({
	after: {
		built: (engine) =>
			Effect.map(Count, (count) => {
				engine.count = count;
			}),
	},
	create: () => Effect.map(Count, (count): Engine => ({ count })),
	layer: Layer.succeed(Count, 1),
	name: "effect hooks",
	run: {
		maxSteps: 1,
		*step() {
			yield* Effect.fail(new Stuck());
		},
	},
	stages: ["built"],
	verbs: (engine) => ({ count: () => engine.count }),
});

it("infers engines and services from Effect-returning setup beside generator run hooks", () => {
	expectTypeOf(kit).toEqualTypeOf<StoryKit<Engine, "built", { count: () => number }, Effect.Effect<never, Stuck>, Count>>();
	const counted = kit.trait("built", "the count is read", (engine) =>
		Effect.map(Count, (count) => {
			engine.count = count;
		}),
	);
	expectTypeOf(counted).toEqualTypeOf<Trait<Engine, "built", Count>>();
	kit.it("uses the provided service", [counted]);
	const missing = kit.trait("built", "a service is missing", () => Effect.asVoid(Missing));
	// @ts-expect-error The worker Layer does not provide the trait's Missing service.
	kit.it("rejects the missing service", [missing]);
});

// @ts-expect-error Effect-returning creation needs its service from the worker Layer.
storyKit({
	create: () => Effect.map(Missing, (count): Engine => ({ count })),
	name: "missing creation service",
	stages: ["built"],
	verbs: () => ({}),
});

it("needs no Layer for Effects without services", () => {
	const plain = storyKit({
		after: { built: () => Effect.void },
		create: () => Effect.succeed<Engine>({ count: 0 }),
		name: "plain effects",
		stages: ["built"],
		verbs: () => ({}),
	});
	expectTypeOf(plain).toEqualTypeOf<StoryKit<Engine, "built", Record<never, never>, never, never>>();
	expectTypeOf(plain.trait("built", "nothing changes", () => Effect.void)).toEqualTypeOf<Trait<Engine, "built", never>>();
});

it("infers after-hook services with synchronous creation and mixed stage hooks", () => {
	const mixed = storyKit({
		after: {
			built: () => Effect.asVoid(Count),
			*counted(engine) {
				expectTypeOf(engine).toEqualTypeOf<Engine>();
				yield* Effect.void;
			},
		},
		create: (): Engine => ({ count: 0 }),
		layer: Layer.succeed(Count, 1),
		name: "mixed hooks",
		stages: ["built", "counted"],
		verbs: () => ({}),
	});
	expectTypeOf(mixed).toEqualTypeOf<StoryKit<Engine, "built" | "counted", Record<never, never>, never, Count>>();
});

// @ts-expect-error Effect-returning after hooks need their service from the worker Layer.
storyKit({
	after: { built: () => Effect.asVoid(Missing) },
	create: (): Engine => ({ count: 0 }),
	name: "missing after service",
	stages: ["built"],
	verbs: () => ({}),
});

const collection = storyKit({
	create: () => new Set<string>(),
	name: "collection",
	stages: [],
	verbs: (items) => ({ add: (item: string) => items.add(item) }),
});

it("infers the engine and verbs with no available trait stage when the stage list is empty", () => {
	expectTypeOf(collection).toEqualTypeOf<StoryKit<Set<string>, never, { add: (item: string) => Set<string> }, never, never>>();
	// @ts-expect-error A kit with no stages cannot accept a staged trait.
	collection.trait("configured", "the collection starts empty", (items) => items.clear());
});

class Selected extends Context.Service<Selected, string>()("stageServices/Selected") {}
class App extends Context.Service<App, string>()("stageServices/App") {}

const stageKit = storyKit({
	after: {
		app: () => Effect.map(Selected, (selected) => Context.make(App, selected)),
		database: () => Effect.succeed(Context.make(Selected, "selected")),
	},
	create: () => ({}),
	inspect: () => App,
	name: "stage services",
	stages: ["database", "app"],
	verbs: () => ({ selected: () => Selected }),
});

it("infers services returned by stages for later hooks, traits and the body", () => {
	const selectedTrait = stageKit.trait("app", "the selected service is read", () => Effect.asVoid(Selected));
	stageKit.it("reads stage-provided services", [selectedTrait], function* ({ selected }) {
		expectTypeOf(yield* selected()).toEqualTypeOf<string>();
		expectTypeOf(yield* App).toEqualTypeOf<string>();
	});
	const missing = stageKit.trait("app", "a service is missing", () => Effect.asVoid(Missing));
	// @ts-expect-error Neither the worker Layer nor a stage provides Missing.
	stageKit.it("rejects missing services", [missing]);
});

// @ts-expect-error Creation runs before stage-provided services are available.
storyKit({
	after: { database: () => Context.make(Selected, "selected") },
	create: () => Effect.as(Selected, {}),
	name: "creation before selection",
	stages: ["database"],
	verbs: () => ({}),
});
