import { Effect, Schema } from "effect";
import * as Field from "#field.ts";
import { formStories } from "./formStories.ts";

const Food = Schema.Struct({ energy: Schema.Struct({ expected: Field.number(), high: Field.number(), low: Field.number() }) });

export const groupedForm = formStories(() => Food, {
	config: () => ({ initialValues: { energy: { expected: "20", high: "30", low: "10" } }, onSubmit: Effect.succeed }),
	support: () => undefined,
	verbs: ({ current }, tell) => ({
		enterLow: (value: string) =>
			Effect.sync(() => {
				tell(`enter ${JSON.stringify(value)} into energy.low`);
				current().changeAt(["energy", "low"], value);
			}),
		low: () => Effect.sync(() => current().fieldAt(["energy", "low"]).value),
	}),
});
