import { Option } from "effect";
import { useLayoutEffect, useRef } from "react";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import { pageQuery } from "#client/page/routeQuery.ts";
import { commitMain, legacyPage, type MainLocation } from "./legacyPage.ts";
import type { ShellApi } from "./ShellApi.ts";
export function LegacyMain({
	api,
	url,
	initial,
	onPage,
}: {
	readonly api: ShellApi;
	readonly url: string;
	readonly initial: string;
	readonly onPage: (location: MainLocation) => void;
}) {
	const hostRef = useRef<HTMLDivElement>(null);
	const query = useQuery(pageQuery(api, url));
	const bootstrapRef = useRef(initial);
	useLayoutEffect(() => {
		if (!hostRef.current) {
			return;
		}
		const html = Option.match(query.data, { onNone: () => bootstrapRef.current, onSome: (page) => page.html });
		if (!html) {
			return;
		}
		bootstrapRef.current = "";
		const location = commitMain(hostRef.current, legacyPage(html));
		if (location) {
			const main = hostRef.current.querySelector<HTMLElement>("#doc");
			if (main && Option.isSome(query.data)) {
				main.dataset.route = url;
				document.dispatchEvent(new Event("board-page"));
			}
			onPage(location);
		}
	}, [query.data, onPage, url]);
	return (
		<>
			<div data-legacy-main ref={hostRef} />
			{Option.isSome(query.cause) && <p role="status">Refresh failed. Your displayed page is retained.</p>}
		</>
	);
}
