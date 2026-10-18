export function readerLink(target: URL) {
	return (
		target.origin === location.origin
		&& (target.pathname === "/"
			|| /^\/_board\/(?:library|goals|system|diagnostics|handoff|result|start|changes|inbox|overview|work)$/u.test(target.pathname)
			|| target.pathname.startsWith("/_board/item/")
			|| /\.md$/iu.test(target.pathname))
	);
}
