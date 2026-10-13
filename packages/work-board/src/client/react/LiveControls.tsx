import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import type { BrowserClient } from "#client/client.ts";
import { activeRead } from "./activeRead.ts";
import { liveStatus } from "./liveStatus.ts";
import { shellIds } from "./shellIds.ts";

const opening = Atom.make({ failed: false, pending: true });
interface Page {
	readonly baseline: string | null;
	readonly kind: string;
	readonly url: string;
}
export function LiveControls({
	client,
	current,
	navigationPending,
	navigationFailed,
}: {
	readonly client: BrowserClient;
	readonly current: string;
	readonly navigationPending: boolean;
	readonly navigationFailed: boolean;
}) {
	const status = useAtomValue(client.updates.status);
	const paused = useAtomValue(client.updates.paused);
	const watcher = useQuery(client.api.watcher.query());
	const watching = Option.getOrUndefined(watcher.data)?.watching === true;
	const [page, setPage] = useState<Page>();
	useEffect(() => {
		function sync() {
			const doc = document.getElementById("doc");
			if (doc?.dataset.route !== current) {
				return;
			}
			setPage({
				baseline: doc?.querySelector<HTMLElement>("[data-baseline]")?.dataset.baseline || null,
				kind: doc?.dataset.projection ?? "document",
				url: current,
			});
		}
		sync();
		document.addEventListener("board-page", sync);
		return () => document.removeEventListener("board-page", sync);
	}, [current]);
	const atom = useMemo(() => (page ? activeRead(client, page.kind, page.url, page.baseline) : opening), [client, page]);
	const reading = useAtomValue(atom);
	const displayed = liveStatus({
		connection: status.connection,
		failed: reading.failed,
		navigationFailed,
		paused,
		pending: status.pending,
		waiting: navigationPending || reading.pending,
		watching,
	});
	useEffect(
		() =>
			client.registry.subscribe(
				client.updates.paused,
				(value) => {
					if (!value) {
						document.dispatchEvent(new Event("board-updates-resumed"));
					}
				},
				{ immediate: true },
			),
		[client],
	);
	return (
		<span className="live" data-state={displayed.state} id={shellIds.live} role="status" title={displayed.title}>
			{displayed.text}
		</span>
	);
}
