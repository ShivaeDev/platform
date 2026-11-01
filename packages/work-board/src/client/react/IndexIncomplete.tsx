export function IndexIncomplete({ paths }: { readonly paths: readonly string[] | undefined }) {
	return paths && paths.length > 0 ? (
		<p role="status">Workspace index incomplete; could not read {paths.join(", ")}. Identity and membership cannot be established completely.</p>
	) : null;
}
