import { Effect } from "effect";
import { postgresMigration } from "@shivaedev/rate-limit/postgresMigration.ts";

export default Effect.gen(function* () {
	yield* postgresMigration;
});
