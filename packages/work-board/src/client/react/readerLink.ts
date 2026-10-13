export function readerLink(target: URL) {
	return (
		target.origin === location.origin
		&& (target.pathname === "/"
			|| /^\/_board\/(?:diagnostics|handoff|result|respond|start|changes|inbox|overview|work)$/u.test(target.pathname)
			|| target.pathname.startsWith("/_board/item/")
			|| /\.md$/iu.test(target.pathname))
	);
}
