import { Cause, type Effect, Option } from "effect";
import { useAction } from "#client/resultState.ts";
import type { connect } from "./connect.ts";

type Client = Effect.Success<ReturnType<typeof connect>>;
export function Editor({ client }: { readonly client: Client }) {
	const action = useAction(client.runtime, client.api.save.run);
	const message = Option.match(action.cause, {
		onNone: () => Option.getOrElse(action.data, () => "Ready"),
		onSome: (cause) =>
			Option.match(Cause.findErrorOption(cause), {
				onNone: () => Cause.pretty(cause),
				onSome: (error) => (error._tag === "EditExpired" ? error.message : String(error)),
			}),
	});
	return (
		<>
			<button onClick={() => action.dispatch(undefined)} type="button">
				Save
			</button>
			<output data-pending={action.pending}>{message}</output>
		</>
	);
}
