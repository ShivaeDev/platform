import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { usePendingCommand } from "#client/pendingCommand.ts";
import { useQuery } from "#client/resultState.ts";
import type { PendingClient } from "./pendingCommandClient.ts";

function ToggleRow({ client, enabled }: { readonly client: PendingClient; readonly enabled: boolean }) {
	const toggle = usePendingCommand(client.command, {
		queries: [client.list, client.count],
		value: enabled,
		wanted: (input) => input.enabled,
	});
	const failure = AsyncResult.error(toggle.result);
	return (
		<li>
			<button aria-pressed={toggle.value} disabled={toggle.pending} onClick={() => toggle.dispatch({ enabled: !toggle.value, id: 1 })} type="button">
				Enabled
			</button>
			<output data-command={toggle.result._tag}>
				{Option.isSome(failure) && failure.value._tag === "ToggleRejected" ? `${failure.value._tag}: ${failure.value.reason}` : ""}
			</output>
		</li>
	);
}
export function PendingCommandScreen({ client }: { readonly client: PendingClient }) {
	const list = useQuery(client.list);
	return (
		<section>
			<output data-list-pending={list.pending}>
				{Option.getOrElse(list.data, () => [])
					.map((row) => String(row.enabled))
					.join(",")}
			</output>
			<ul>
				{Option.getOrElse(list.data, () => []).map((row) => (
					<ToggleRow client={client} enabled={row.enabled} key={row.id} />
				))}
			</ul>
		</section>
	);
}
