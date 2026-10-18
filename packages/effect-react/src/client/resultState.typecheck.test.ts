import { type Cause, Effect, type Option } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { useAction, useQuery } from "#client/resultState.ts";

const query = Atom.make(
	Effect.succeed({ id: 1, title: "Quarterly report" }).pipe(
		Effect.andThen((row) => (row.id > 0 ? Effect.succeed(row) : Effect.fail("MissingReport" as const))),
	),
);
const action = Atom.fn<{
	readonly title: string;
}>()((input) => (input.title.length > 0 ? Effect.succeed({ id: 1, title: input.title }) : Effect.fail("InvalidTitle" as const)));
export function useExample() {
	const result = useQuery(query);
	const retained = useQuery(query, { keepPreviousData: true });
	const queryFailure: Option.Option<Cause.Cause<"MissingReport">> = retained.cause;
	const queryData: Option.Option<{
		id: number;
		title: string;
	}> = retained.data;
	const data: Option.Option<{
		id: number;
		title: string;
	}> = result.data;
	const mutation = useAction(action);
	const dispatch: (input: { readonly title: string }) => void = mutation.dispatch;
	const failure: Option.Option<Cause.Cause<"InvalidTitle">> = mutation.cause;
	const output: Option.Option<{
		id: number;
		title: string;
	}> = mutation.data;
	// @ts-expect-error The action input remains the declared object shape.
	mutation.dispatch({ title: 1 });
	// @ts-expect-error Query data does not invent fields outside the success type.
	const unrelated: Option.Option<{
		missing: number;
	}> = result.data;
	void unrelated;
	return { data, dispatch, failure, output, queryData, queryFailure };
}
