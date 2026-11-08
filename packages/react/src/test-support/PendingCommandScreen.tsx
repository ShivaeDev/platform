import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { usePendingCommand } from "#client/pendingCommand.ts";
import { useQuery } from "#client/resultState.ts";
import type { PendingClient } from "#test/pendingCommandClient.ts";
import type { PushedSwitchClient } from "#test/pushedSwitchClient.ts";

function ToggleRow({ client, enabled, id }: { readonly client: PendingClient; readonly enabled: boolean; readonly id: number }) {
	const toggle = usePendingCommand(client.command(id), {
		queries: [client.list, client.count],
		value: enabled,
		wanted: (input) => input.enabled,
	});
	const failure = AsyncResult.error(toggle.result);
	const message = Option.isSome(failure) && failure.value._tag === "ToggleRejected" ? `${failure.value._tag}: ${failure.value.reason}` : "";
	return (
		<li data-row={id}>
			<button aria-pressed={toggle.value} disabled={toggle.pending} onClick={() => toggle.dispatch({ enabled: !toggle.value })} type="button">
				Enabled
			</button>
			<output data-command={toggle.result._tag}>{message}</output>
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
					<ToggleRow client={client} enabled={row.enabled} id={row.id} key={row.id} />
				))}
			</ul>
		</section>
	);
}
export function PushedSwitchScreen({ client }: { readonly client: PushedSwitchClient }) {
	const current = useQuery(client.query);
	const enabled = Option.getOrElse(current.data, () => false);
	const toggle = usePendingCommand(client.set, { queries: [client.query], value: enabled, wanted: (input) => input.enabled });
	if (Option.isNone(current.data)) {
		return null;
	}
	return (
		<section>
			<button aria-pressed={toggle.value} disabled={toggle.pending} onClick={() => toggle.dispatch({ enabled: !toggle.value })} type="button">
				Enabled
			</button>
			<output data-command={toggle.result._tag} />
		</section>
	);
}
