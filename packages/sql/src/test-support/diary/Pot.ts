import { Schema } from "effect";
import { Model } from "effect/schema";

export class Pot extends Model.Class<Pot>("SharedPot")({
	amount: Schema.Int,
	id: Schema.Int,
	pending: Schema.Int,
}) {}
