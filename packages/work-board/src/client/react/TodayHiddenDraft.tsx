export function TodayHiddenDraft({ href, text }: { readonly href: string; readonly text: string }) {
	return text ? (
		<p className="m-0 text-muted-foreground text-xs" data-hidden-draft="">
			{text}{" "}
			<a className="underline underline-offset-4 hover:text-foreground" href={href}>
				Review it on the item page
			</a>
		</p>
	) : null;
}
