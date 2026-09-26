import { collection, command, contract, fieldRejection, query } from "@shivaedev/effect-contract";
import { Context, Schema } from "effect";
import { RpcMiddleware } from "effect/unstable/rpc";

export class Meal extends Schema.Class<Meal>("Meal")({
	id: Schema.Number,
	name: Schema.String,
	calories: Schema.Number,
}) {}
export const MealDraft = Schema.Struct({ name: Meal.fields.name, calories: Meal.fields.calories });
export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {}) {}
export class MealNotFound extends Schema.TaggedError<MealNotFound>()("MealNotFound", {}) {}
export class StorageUnavailable extends Schema.TaggedError<StorageUnavailable>()("StorageUnavailable", {}) {}
export class Principal extends Context.Service<Principal, { readonly userId: string }>()("meal/Principal") {}
export class Authentication extends RpcMiddleware.Service<Authentication, { provides: Principal }>()("meal/Authentication", {
	error: Unauthorized,
}) {}

export const meals = collection("meals", Meal.fields.id);
export const GetMeal = query("get", {
	payload: { id: Meal.fields.id },
	success: Meal,
	rejections: { MealNotFound, StorageUnavailable },
	reads: ({ id }) => [meals.item(id)],
});
export const ListMeals = query("list", {
	success: Schema.Array(Meal),
	rejections: { StorageUnavailable },
	reads: () => [meals.list],
});
export const SaveMeal = command("save", {
	payload: { id: Meal.fields.id, ...MealDraft.fields },
	success: Meal,
	rejections: { MealNotFound, MealValidation: fieldRejection(MealDraft), StorageUnavailable },
	invalidates: ({ id }) => [meals.item(id)],
});
export type SaveMealInput = typeof SaveMeal.payload.Type;

export const Meals = contract("meals", { queries: [GetMeal, ListMeals], commands: [SaveMeal] }).middleware(Authentication);
