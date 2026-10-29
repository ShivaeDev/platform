import { CheckCircle2 } from "lucide-react";
import { useRef, useState } from "react";
import type { ShellApi } from "./ShellApi.ts";
import { TodayNeeds } from "./TodayNeeds.tsx";
import { todayIds } from "./todayIds.ts";
import type { useSavedAnswers } from "./useSavedAnswers.ts";

export function TodayNeedsYou({
	answering,
	api,
	complete,
	identified,
}: {
	readonly answering: ReturnType<typeof useSavedAnswers>;
	readonly api: ShellApi;
	readonly complete: boolean;
	readonly identified: boolean;
}) {
	const headingRef = useRef<HTMLHeadingElement>(null);
	const [announced, setAnnounced] = useState(false);
	return (
		<section className="min-w-0" id={todayIds.needs}>
			<div className="mb-3 flex items-baseline justify-between gap-3">
				<h2 className="m-0 text-lg font-semibold outline-none" id={todayIds.needsHeading} ref={headingRef} tabIndex={-1}>
					Needs you
				</h2>
				<p className="text-muted-foreground m-0 flex items-center gap-1 text-sm" role="status">
					{announced ? (
						<>
							<CheckCircle2 aria-hidden="true" className="text-done size-4" />
							Answer saved
						</>
					) : null}
				</p>
			</div>
			<TodayNeeds
				api={api}
				complete={complete}
				identified={identified}
				items={answering.items}
				onSaved={(item) => {
					answering.save(item);
					setAnnounced(true);
					requestAnimationFrame(() => {
						if (document.activeElement === null || document.activeElement === document.body) {
							headingRef.current?.focus();
						}
					});
				}}
			/>
		</section>
	);
}
