import { Effect, Schema } from "effect";
import { useList } from "#adapters/useList.ts";
import * as Field from "#field.ts";
import { form } from "#form.ts";

const Fields = Schema.Struct({
	amount: Field.number({ optional: true }),
	count: Field.number({ integer: true }),
	values: Field.list(Field.number(), { max: 5 }),
});

const model = form(Fields, {
	initialValues: { amount: "", count: "1", values: ["2"] },
	onSubmit: (values) => {
		const optional: number | null = values.amount;
		const required: number = values.count;
		const list: readonly number[] = values.values;
		void [optional, required, list];
		// @ts-expect-error Optional numbers can decode to null.
		const populated: number = values.amount;
		void populated;
		return Effect.succeed(values);
	},
});

function useTypedList() {
	const list = useList(model, "values");
	list.add("3");
	// @ts-expect-error List edits use encoded strings.
	list.add(3);
	// @ts-expect-error A scalar field is not a list.
	useList(model, "count");
}
void useTypedList;
