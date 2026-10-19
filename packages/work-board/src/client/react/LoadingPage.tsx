import { Skeleton } from "#client/react/components/ui/skeleton.tsx";
import { IndexingProgress } from "./IndexingProgress.tsx";
import { Loading } from "./loading.tsx";
import { SkeletonCards, SkeletonDocument, SkeletonLanes, SkeletonRows, SkeletonSection, SkeletonTable } from "./skeletons.tsx";

type Shape = "cards" | "document" | "lanes" | "rows" | "table" | "today";

const documentPage = { label: "Loading page", shape: "document" } as const;

export function LoadingPage({ board = false, url }: { readonly board?: boolean; readonly url?: string }) {
	const { label, shape } = url === undefined ? documentPage : pageShape(url, board);
	return (
		<div className="space-y-6">
			<IndexingProgress />
			<Loading className="space-y-6" label={label}>
				<div className="space-y-2">
					<Skeleton className="h-7 w-40" />
					<Skeleton className="h-4 w-64 max-w-full" />
				</div>
				<PageBody shape={shape} />
			</Loading>
		</div>
	);
}

function pageShape(url: string, board: boolean): { readonly label: string; readonly shape: Shape } {
	const { pathname, searchParams } = new URL(url, "http://127.0.0.1");
	const view = searchParams.get("view");
	if (board) {
		return { label: "Loading board", shape: "lanes" };
	}
	switch (pathname) {
		case "/":
			return { label: "Loading Today", shape: "today" };
		case "/_board/goals":
			return { label: "Loading Goals", shape: "cards" };
		case "/_board/work":
			return view === "table"
				? { label: "Loading All work", shape: "table" }
				: { label: view === "board" ? "Loading All work" : "Loading Now", shape: "lanes" };
		case "/_board/library":
			return { label: "Loading Library", shape: "rows" };
		case "/_board/system":
			return { label: "Loading System", shape: "cards" };
		default:
			return documentPage;
	}
}

function PageBody({ shape }: { readonly shape: Shape }) {
	switch (shape) {
		case "today":
			return (
				<div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" data-loading-shape="today">
					<div className="min-w-0 space-y-6">
						<SkeletonSection>
							<SkeletonRows rows={4} />
						</SkeletonSection>
						<SkeletonSection>
							<SkeletonRows rows={3} />
						</SkeletonSection>
					</div>
					<SkeletonSection>
						<SkeletonCards cards={2} columns={1} />
					</SkeletonSection>
				</div>
			);
		case "cards":
			return <SkeletonCards cards={4} />;
		case "lanes":
			return <SkeletonLanes />;
		case "table":
			return <SkeletonTable />;
		case "rows":
			return <SkeletonRows rows={8} />;
		case "document":
			return <SkeletonDocument />;
	}
}
