import { Option } from "effect";
import { useEffect, useState } from "react";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import { historyStore } from "./historyStore.ts";
import type { ShellApi } from "./ShellApi.ts";

export function HistoryRetention({ api }: { readonly api: ShellApi }) {
	const [store] = useState(historyStore);
	const [baseline, setBaseline] = useState(store.read);
	const query = useQuery(api.history.query({ action: "check", baseline }));
	const data = Option.getOrUndefined(query.data);
	useEffect(() => {
		if (data?.discardBaseline && store.read() === baseline) {
			store.write(null);
			setBaseline(null);
			document.documentElement.dataset.historyNotice = data.reason;
		}
	}, [baseline, data, store]);
	useEffect(() => {
		function sync(event: StorageEvent) {
			if (event.key === store.key || event.key === null) {
				setBaseline(store.read());
			}
		}
		window.addEventListener("storage", sync);
		return () => window.removeEventListener("storage", sync);
	}, [store]);
	return null;
}
