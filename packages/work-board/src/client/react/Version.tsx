export function Version({ revision }: { readonly revision: string }) {
	return (
		<code className="font-mono" title={`SHA-256 ${revision}`}>
			{revision.slice(0, 12)}
		</code>
	);
}
