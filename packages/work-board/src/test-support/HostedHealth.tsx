import * as HttpStatus from "effect/http/HttpStatus";
import { useState } from "react";
import { LiveControls } from "#client/react/LiveControls.tsx";
import { MainLocationContext, useMainLocation } from "#client/react/MainLocationContext.ts";
import { emptyMainLocation } from "#client/react/mainLocation.ts";
import { pageFailureCauses } from "#client/react/pageFailureCauses.ts";
import { retryPage } from "#client/react/retryPage.ts";

export type LiveClient = Parameters<typeof LiveControls>[0]["client"];
export function Controls({ client }: { readonly client: LiveClient }) {
	const page = useMainLocation();
	return (
		<>
			<LiveControls client={client} navigationFailed={false} navigationPending={false} />
			<button data-retry onClick={() => retryPage(client.api, client.registry, page)} type="button">
				Retry
			</button>
		</>
	);
}
export function HostedHealth({ client }: { readonly client: LiveClient }) {
	const [page, setPage] = useState({
		...emptyMainLocation,
		failure: pageFailureCauses.unavailable,
		projection: "system",
		route: "/_board/system",
		status: HttpStatus.fromLiteral("ServiceUnavailable"),
	});
	return (
		<MainLocationContext.Provider value={page}>
			<Controls client={client} />
			<button
				data-document
				onClick={() =>
					setPage({
						...emptyMainLocation,
						failure: pageFailureCauses.unavailable,
						route: "/broken.md",
						status: HttpStatus.fromLiteral("ServiceUnavailable"),
					})
				}
				type="button"
			>
				Document
			</button>
		</MainLocationContext.Provider>
	);
}
