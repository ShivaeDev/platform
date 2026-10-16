import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { RouterShell } from "#client/react/loadBoardPage.ts";
import { currentEntry, navigationFailure, readingKey, sameReadingLocation } from "#client/react/navigationLocation.ts";
import { readerLink } from "#client/react/readerLink.ts";
import { captureReading } from "#client/react/readingState.ts";
import { retryPage } from "#client/react/retryPage.ts";
import { scheduleReading } from "#client/react/scheduleReading.ts";
import { readingEntry, storedReadings } from "#client/react/storedReadings.ts";

export function useBoardNavigation(shell: RouterShell) {
	const router = useRouter();
	const [status, setStatus] = useState("");
	useEffect(() => {
		const readings = storedReadings();
		const initial = readingEntry(shell.reading ?? window.history.state?.workBoard);
		const aliases = new Map<string, string>();
		let displayed = "";
		let route = "";
		let hash = "";
		let failure = "";
		let interrupted = false;
		function save() {
			if (!displayed || document.getElementById("doc")?.dataset.route !== route) {
				interrupted ||= displayed !== "";
				return;
			}
			const reading = captureReading();
			if (reading) {
				readings.save(displayed, reading);
			}
		}
		function page() {
			const location = router.state.resolvedLocation ?? router.state.location;
			const nextRoute = location.pathname + location.searchStr;
			const doc = document.getElementById("doc");
			if (doc?.dataset.route !== nextRoute) {
				return;
			}
			const previousFailure = failure;
			failure = navigationFailure(doc.dataset.status);
			if (failure) {
				setStatus(failure);
				return;
			}
			setStatus((current) => (current === previousFailure ? "" : current));
			const key = location.state.key ?? nextRoute;
			const entry = currentEntry(location.state, displayed, initial);
			const id = readingKey(key, entry, aliases);
			if (!interrupted && sameReadingLocation({ hash, id: displayed, route }, { hash: location.hash, id, route: nextRoute })) {
				return;
			}
			interrupted = false;
			const reading = readings.get(id) ?? entry?.reading;
			const focus = displayed !== "";
			displayed = id;
			route = nextRoute;
			hash = location.hash;
			recordEntry(router, nextRoute, id, shell.client !== undefined);
			scheduleReading(doc, reading, hash, () => displayed === id && doc.dataset.route === nextRoute, setStatus, focus);
		}
		async function open(target: URL) {
			save();
			document.dispatchEvent(new Event("board-navigate"));
			const url = target.pathname + target.search + target.hash;
			if (url === router.state.location.href && retryPage(shell.api, shell.registry, target.pathname + target.search)) {
				await router.invalidate();
			} else if (url !== router.state.location.href) {
				await router.navigate({ to: url });
			}
			page();
		}
		function click(event: MouseEvent) {
			const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
			if (
				!link
				|| event.defaultPrevented
				|| event.button !== 0
				|| event.ctrlKey
				|| event.metaKey
				|| event.shiftKey
				|| event.altKey
				|| link.hasAttribute("download")
				|| (link.target && link.target !== "_self")
			) {
				return;
			}
			const target = new URL(link.href, location.href);
			if (!readerLink(target)) {
				return;
			}
			event.preventDefault();
			void open(target);
		}
		function submit(event: SubmitEvent) {
			const form = event.target;
			if (!(form instanceof HTMLFormElement) || form.id !== "work-filters") {
				return;
			}
			event.preventDefault();
			const target = new URL(form.action, location.href);
			target.search = new URLSearchParams([...new FormData(form)].map(([key, value]) => [key, String(value)])).toString();
			void open(target);
		}
		document.addEventListener("submit", submit);
		const before = router.subscribe("onBeforeNavigate", save);
		const resolved = router.subscribe("onResolved", page);
		window.history.scrollRestoration = "manual";
		document.addEventListener("click", click);
		document.addEventListener("board-page", page);
		window.addEventListener("pagehide", save);
		page();
		return () => {
			before();
			resolved();
			document.removeEventListener("submit", submit);
			document.removeEventListener("click", click);
			document.removeEventListener("board-page", page);
			window.removeEventListener("pagehide", save);
		};
	}, [router, shell.api, shell.registry, shell.reading, shell.client]);
	return status;
}

function recordEntry(router: ReturnType<typeof useRouter>, route: string, id: string, native: boolean) {
	if (!native) {
		return;
	}
	router.history.flush?.();
	if (window.location.pathname + window.location.search !== route || window.history.state?.workBoard?.id === id) {
		return;
	}
	window.history.replaceState({ ...window.history.state, workBoard: { id } }, "");
}
