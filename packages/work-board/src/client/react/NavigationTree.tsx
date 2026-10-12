import { useEffect, useRef } from "react";
import type { Navigation, NavigationFile, NavigationFolder } from "#browser/navigation/schema.ts";

function Files({ files, current }: { readonly files: readonly NavigationFile[]; readonly current: string }) {
	return files.map((file) => (
		<li key={file.path}>
			<a aria-current={file.path === current ? "page" : undefined} href={file.href}>
				{file.name}
			</a>
			<span className="age short" data-modified={file.modified} />
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
		<li className="file-folder">
			<details data-key={`folder:${folder.path}`} ref={ref}>
				<summary>
					{folder.name}/ ({folder.count})
				</summary>
				<Tree current={current} folder={folder} />
			</details>
		</li>
	);
}
function Tree({ folder, count, current }: { readonly folder: NavigationFolder; readonly count?: string; readonly current: string }) {
	return (
		<ul data-inbox-count={count}>
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
				<details data-key="fleet-records" ref={recordsRef}>
					<summary>Fleet records ({data.records.count})</summary>
					<ul>
						<Files current={current} files={data.records.files} />
					</ul>
				</details>
			)}
		</>
	);
}
