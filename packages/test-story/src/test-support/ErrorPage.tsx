import { useBrowserErrors } from "@shivaedev/react/client/adapters/useBrowserErrors.ts";

export function ErrorPage() {
	useBrowserErrors();
	return (
		<button
			onClick={() => {
				throw new Error("page action failed");
			}}
			type="button"
		>
			Crash
		</button>
	);
}
