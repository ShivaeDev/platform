import { Cause, type Effect, Option } from "effect";
import { useConnectionStatus } from "#client/adapters/useConnectionStatus.ts";
import { useAction } from "#client/resultState.ts";
import type { connect } from "#test/socket-clock/connect.ts";

type Client = Effect.Success<ReturnType<typeof connect>>;
export function View({ client }: { readonly client: Client }) {
	const action = useAction(client.runtime, client.api.save.run);
	const connection = useConnectionStatus(client.connection);
	const message = Option.match(action.cause, {
		onNone: () => Option.getOrElse(action.data, () => "Ready"),
		onSome: (cause) =>
			Option.match(Cause.findErrorOption(cause), {
				onNone: () => Cause.pretty(cause),
				onSome: (error) =>
					error._tag === "RpcClientError"
						? `${error._tag}: ${error.reason._tag}${error.reason._tag === "SocketOpenError" ? ` ${error.reason.kind}` : ""}`
						: error.message,
			}),
	});
	const notice = connection === "waiting-for-connection" ? "Reconnecting" : connection;
	return (
		<>
			<button disabled={action.pending} onClick={() => action.dispatch(undefined)} type="button">
				Save
			</button>
			<p role="status">{notice}</p>
			<output data-pending={action.pending}>{message}</output>
		</>
	);
}
