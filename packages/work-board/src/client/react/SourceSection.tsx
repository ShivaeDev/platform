import { useState } from "react";
import { type SourceLink, sourceGroups } from "#browser/document/sourceGroups.ts";
import { StatusChip } from "#client/react/StatusChip.tsx";

export function SourceSection({ label, links, name }: { readonly label: string; readonly links: readonly SourceLink[]; readonly name?: string }) {
	return (
		<section aria-label={name ?? label}>
			<h4 className="mt-4 mb-1 font-medium text-muted-foreground text-xs">{label}</h4>
			<SourceList links={links} />
		</section>
	);
}

function SourceList({ links }: { readonly links: readonly SourceLink[] }) {
	return (
		<ul>
			{sourceGroups(links).map((group) => (
				<SourceGroup group={group} key={group.title} />
			))}
		</ul>
	);
}

function SourceGroup({ group }: { readonly group: ReturnType<typeof sourceGroups>[number] }) {
	const [open, setOpen] = useState(false);
	const links = group.sources.map((link) => (
		<li key={link.href}>
			<Source link={link} />
		</li>
	));
	if (group.sources.length === 1) {
		return links;
	}
	return (
		<li>
			<details onToggle={(event) => setOpen(event.currentTarget.open)} open={open}>
				<summary className="cursor-pointer pointer-coarse:py-3">{group.label}</summary>
				{Boolean(open) && <ul>{links}</ul>}
			</details>
		</li>
	);
}

function Source({ link }: { readonly link: SourceLink }) {
	return (
		<span className="inline-flex flex-wrap items-center gap-2">
			<a
				className="pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center underline underline-offset-4"
				href={link.href}
				title={link.label}
			>
				{link.title ?? link.label}
			</a>
			<StatusChip status={link.status} />
		</span>
	);
}
