import { useEffect, useRef } from "react";
import type { Navigation, NavigationFile, NavigationFolder } from "#browser/navigation/schema.ts";
import { Age } from "./Age.tsx";

function Files({ files, current }: { readonly files: readonly NavigationFile[]; readonly current: string }) {
	return files.map((file) => (
		<li className="m-0 flex items-baseline gap-2 rounded-md px-2 py-1 has-[a[aria-current=page]]:bg-accent" key={file.path}>
			<a
				aria-current={file.path === current ? "page" : undefined}
				className="min-w-0 flex-1 break-words text-foreground no-underline hover:underline"
				href={file.href}
			>
				{file.name}
			</a>
			<Age modified={file.modified} short />
		</li>
	));
}
function Folder({ folder, current }: { readonly folder: NavigationFolder; readonly current: string }) {
	const ref = useRef<HTMLDetailsElement>(null);
	useEffect(() => {
		if (current.startsWith(`${folder.path}/`) && ref.current) {
			ref.current.open = true;
		}
	}, [current, folder.path]);
	return (
		<li className="m-0 block p-0">
			<details className="my-2" data-key={`folder:${folder.path}`} ref={ref}>
				<summary className="cursor-pointer break-words px-2 py-1 text-muted-foreground">
					{folder.name}/ ({folder.count})
				</summary>
				<Tree current={current} folder={folder} />
			</details>
		</li>
	);
}
function Tree({ folder, count, current }: { readonly folder: NavigationFolder; readonly count?: string; readonly current: string }) {
	return (
		<ul className="m-0 list-none p-0" data-inbox-count={count}>
			<Files current={current} files={folder.files} />
			{folder.folders.map((child) => (
				<Folder current={current} folder={child} key={child.path} />
			))}
		</ul>
	);
}
export function NavigationTree({ data, current }: { readonly data: Navigation; readonly current: string }) {
	const recordsRef = useRef<HTMLDetailsElement>(null);
	const activeRecord = data.records.files.find((file) => file.path === current)?.path;
	useEffect(() => {
		if (activeRecord && recordsRef.current) {
			recordsRef.current.open = true;
		}
	}, [activeRecord]);
	return (
		<>
			<Tree count={String(data.inboxCount ?? "?")} current={current} folder={data.tree} />
			{data.records.count > 0 && (
				<details className="my-2" data-key="fleet-records" ref={recordsRef}>
					<summary className="cursor-pointer break-words px-2 py-1 text-muted-foreground">Fleet records ({data.records.count})</summary>
					<ul className="m-0 list-none border-l pl-3">
						<Files current={current} files={data.records.files} />
					</ul>
				</details>
			)}
		</>
	);
}
