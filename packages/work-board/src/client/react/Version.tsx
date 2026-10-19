export function Version({ revision, kind = "SHA-256" }: { readonly revision: string; readonly kind?: string }) {
	return (
		<code className="font-mono" title={`${kind} ${revision}`}>
			{revision.slice(0, 12)}
		</code>
	);
}
