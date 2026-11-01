import { httpClient } from "./story.ts";

export const threeLinkedPages = httpClient.trait(
	"routes",
	"the remote lists paper, ink and pens one to a page; page 1 links next to the relative 2?cursor=two with a quoted comma before its rel, and page 2 links next to the absolute /pages/3",
	({ links }) => {
		links.set(1, '<../other>; rel=prev, <2?cursor=two>; title="ink, page 2"; rel="alternate next"');
		links.set(2, '<1>; rel="prev", </pages/3>; rel=next');
		links.set(3, '<2>; rel="prev"');
	},
);

export const pageOneLinksToAnotherOrigin = httpClient.trait(
	"routes",
	"page 1 links next to /page?token=private on another origin",
	({ links, otherOrigin }) => {
		links.set(1, `<${otherOrigin.url}/page?token=private>; rel="next"`);
	},
);

export const redirectedPages = httpClient.trait(
	"routes",
	"page 1 redirects to /archive/pages/1 whose next link is relative",
	({ replies, links }) => {
		replies.pageRedirect = { headers: { location: "/archive/pages/1" }, status: 302 };
		links.set(1, '<2>; rel="next"');
	},
);
