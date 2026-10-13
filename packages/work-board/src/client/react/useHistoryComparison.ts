import { RegistryContext } from "@effect/atom-react";
import { Option } from "effect";
import { useContext, useEffect, useRef, useState } from "react";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import { loadQuery } from "@shivaedev/effect-react/router.ts";
import { session } from "#client/entry.ts";
import { historyStore } from "./historyStore.ts";
import type { ShellApi } from "./ShellApi.ts";
export function useHistoryComparison(api: ShellApi) {
	const registry = useContext(RegistryContext);
	const [store] = useState(historyStore);
	const [baseline, setBaseline] = useState(store.read);
	const [isBusy, setIsBusy] = useState(false);
	const [failure, setFailure] = useState(() => document.documentElement.dataset.historyNotice ?? "");
	const controllerRef = useRef<AbortController | undefined>(undefined);
	const generationRef = useRef(0);
	const atom = api.history.query({ action: "compare", baseline });
	const query = useQuery(atom);
	const data = Option.getOrUndefined(query.data);
	function cancel() {
		generationRef.current += 1;
		controllerRef.current?.abort();
		setIsBusy(false);
	}
	function clear() {
		delete document.documentElement.dataset.historyNotice;
		cancel();
		store.write(null);
		setBaseline(null);
		setFailure("");
		registry.refresh(api.history.query({ action: "compare", baseline: null }));
	}
	useEffect(() => {
		if (data?.discardBaseline && baseline === store.read()) {
			store.write(null);
			setBaseline(null);
			setFailure(data.reason);
		}
	}, [baseline, data, store]);
	useEffect(() => {
		function refresh() {
			const native = session(window);
			if (!(document.hidden || native.registry.get(native.updates.paused) || isBusy)) {
				registry.refresh(atom);
			}
		}
		function sync(event: StorageEvent) {
			if (event.key === store.key || event.key === null) {
				generationRef.current += 1;
				controllerRef.current?.abort();
				setIsBusy(false);
				setBaseline(store.read());
				setFailure("");
				refresh();
			}
		}
		const timer = setInterval(refresh, 60_000);
		document.addEventListener("board-updates-resumed", refresh);
		document.addEventListener("visibilitychange", refresh);
		window.addEventListener("storage", sync);
		return () => {
			clearInterval(timer);
			document.removeEventListener("board-updates-resumed", refresh);
			document.removeEventListener("visibilitychange", refresh);
			window.removeEventListener("storage", sync);
		};
	}, [atom, isBusy, registry, store]);
	useEffect(() => {
		async function validate() {
			const raw = store.read();
			try {
				const check = api.history.query({ action: "check", baseline: raw });
				registry.refresh(check);
				const result = await loadQuery(registry, check, { abortController: new AbortController() });
				if (raw !== store.read()) {
					return;
				}
				if (result.discardBaseline) {
					store.write(null);
					setBaseline(null);
					setFailure(result.reason);
				} else if (raw !== baseline) {
					setBaseline(raw);
					registry.refresh(api.history.query({ action: "compare", baseline: raw }));
				}
			} catch {
				setFailure("History validation is unavailable. Your remembered snapshot is preserved.");
			}
		}
		document.addEventListener("board-page", validate);
		return () => document.removeEventListener("board-page", validate);
	}, [api, baseline, registry, store]);
	useEffect(() => {
		function stop() {
			generationRef.current += 1;
			controllerRef.current?.abort();
		}
		window.addEventListener("pagehide", stop);
		return () => {
			stop();
			window.removeEventListener("pagehide", stop);
		};
	}, []);
	async function observe() {
		if (isBusy) {
			return;
		}
		generationRef.current += 1;
		const mine = generationRef.current;
		controllerRef.current?.abort();
		controllerRef.current = new AbortController();
		setIsBusy(true);
		try {
			const native = session(window);
			const next = await native.run(native.api.history.run({ action: "observe", baseline }), controllerRef.current.signal);
			if (mine !== generationRef.current) {
				return;
			}
			if (next.snapshot === null) {
				setFailure(next.reason);
				return;
			}
			delete document.documentElement.dataset.historyNotice;
			store.write(next.snapshot);
			setBaseline(next.snapshot);
			setFailure("");
			registry.refresh(api.history.query({ action: "compare", baseline: next.snapshot }));
		} catch {
			if (mine === generationRef.current) {
				setFailure("Could not remember the current observation. Your previous baseline is preserved.");
			}
		} finally {
			if (mine === generationRef.current) {
				setIsBusy(false);
			}
		}
	}
	const message = Option.isSome(query.cause)
		? "History is unavailable: the current observation could not be loaded. No comparison or removals are inferred."
		: failure;
	return { atom, available: Option.isNone(query.cause), baseline, busy: isBusy, clear, message, notice: store.notice(), observe };
}
