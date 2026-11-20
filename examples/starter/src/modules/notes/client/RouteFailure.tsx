import type { ErrorComponentProps } from "@tanstack/react-router";
import type { ReactElement } from "react";

export function RouteFailure({ reset: handleClick }: ErrorComponentProps): ReactElement {
	return (
		<main className="mx-auto max-w-md space-y-4 px-4 py-12">
			<p role="alert">Could not load notes.</p>
			<button onClick={handleClick} type="button">
				Retry
			</button>
		</main>
	);
}
