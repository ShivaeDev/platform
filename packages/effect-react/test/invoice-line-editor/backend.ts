import { bind, collection, command, contract, fieldRejection, query } from "@shivaedev/effect-contract";
import { Context, Deferred, Effect, Layer, Schema } from "effect";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { RpcMiddleware, RpcTest } from "effect/unstable/rpc";

export class Food extends Schema.Class<Food>("Food")({
	id: Schema.Number,
	name: Schema.String,
	grams: Schema.Number,
}) {}
export const FoodDraft = Schema.Struct({ name: Food.fields.name, grams: Food.fields.grams });
export class Unavailable extends Schema.TaggedError<Unavailable>()("Unavailable", {}) {}
export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {}) {}
class Principal extends Context.Service<Principal, { readonly user: string }>()("food/Principal") {}
class Guard extends RpcMiddleware.Service<Guard, { provides: Principal }>()("food/Guard", { error: Unauthorized }) {}

const foods = collection("foods", Food.fields.id);
const GetFood = query("get", {
	payload: { id: Schema.Number },
	success: Food,
	rejections: { FoodNotFound: {}, Unavailable },
	reads: ({ id }) => [foods.item(id)],
});
const SaveFood = command("save", {
	payload: { id: Schema.Number, ...FoodDraft.fields },
	success: Food,
	rejections: { FoodRejected: fieldRejection(FoodDraft), Unavailable },
	invalidates: ({ id }) => [foods.item(id)],
});
const CreateFood = command("create", {
	payload: FoodDraft,
	success: Food,
	rejections: { FoodRejected: fieldRejection(FoodDraft), Unavailable },
	invalidates: (_draft, food) => [foods.item(food.id), foods.list],
});
export const Foods = contract("foods", { queries: [GetFood], commands: [SaveFood, CreateFood] }).middleware(Guard);

interface Control {
	mode: "ok" | "unavailable" | "unauthorized";
	gets: number;
	saves: number;
	held: Deferred.Deferred<void> | undefined;
}

export const makeFoodServer = (initial: ReadonlyArray<Food>) => {
	const store = new Map(initial.map((food) => [food.id, food]));
	const control: Control = { mode: "ok", gets: 0, saves: 0, held: undefined };
	const hold = () => {
		const gate = Effect.runSync(Deferred.make<void>());
		control.held = gate;
		return () => Effect.runSync(Deferred.succeed(gate, undefined));
	};
	const admitted = Effect.suspend((): Effect.Effect<void, Unavailable> => {
		const gate = control.held;
		control.held = undefined;
		if (control.mode === "unavailable") return Effect.fail(new Unavailable());
		return gate === undefined ? Effect.void : Deferred.await(gate);
	});
	const normalized = (
		draft: typeof FoodDraft.Type,
	): Effect.Effect<typeof FoodDraft.Type, { readonly field: "name" | "grams"; readonly message: string }> => {
		const name = draft.name.trim();
		if (name.length > 20) return Effect.fail({ field: "name", message: "Name is too long" });
		if (draft.grams > 5000) return Effect.fail({ field: "grams", message: "Too heavy" });
		return Effect.succeed({ name: name.charAt(0).toUpperCase() + name.slice(1), grams: draft.grams });
	};
	const stored = (food: Food) => Effect.sync(() => store.set(food.id, food)).pipe(Effect.as(food));
	const counted = Effect.sync(() => {
		control.saves += 1;
	}).pipe(Effect.andThen(admitted));
	const handlers = Foods.toLayer({
		"foods.get": ({ id }) =>
			admitted.pipe(
				Effect.andThen(() => {
					control.gets += 1;
					const food = store.get(id);
					return food === undefined ? GetFood.reject.FoodNotFound() : Effect.succeed(food);
				}),
			),
		"foods.save": ({ id, ...draft }) =>
			counted.pipe(
				Effect.andThen(normalized(draft).pipe(Effect.catch((rejection) => SaveFood.reject.FoodRejected(rejection)))),
				Effect.flatMap((values) => stored(new Food({ id, ...values }))),
			),
		"foods.create": (draft) =>
			counted.pipe(
				Effect.andThen(normalized(draft).pipe(Effect.catch((rejection) => CreateFood.reject.FoodRejected(rejection)))),
				Effect.flatMap((values) => stored(new Food({ id: store.size + 1, ...values }))),
			),
	});
	const guard = Layer.succeed(Guard, (effect) =>
		Effect.suspend(() =>
			control.mode === "unauthorized" ? Effect.fail(new Unauthorized()) : Effect.provideService(effect, Principal, { user: "ada" }),
		),
	);
	class Client extends AtomRpc.Service<Client>()("test/FoodClient", {
		group: Foods,
		protocol: Layer.merge(handlers, guard),
		makeEffect: RpcTest.makeClient(Foods, { flatten: true }),
	}) {}
	const api = bind(Foods, Client);
	const edit = (food: Food) => store.set(food.id, food);
	return { api, runtime: Client.runtime, control, hold, edit, stored: (id: number) => store.get(id) };
};
