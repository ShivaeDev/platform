---
"@shivaedev/work-board": patch
---

### Changed

- The Board compresses its scripts, stylesheet, page shell and RPC answers with Brotli or gzip when the browser accepts them.
- Content-hashed bundle chunks and Mermaid chunks are cached for a year as immutable; `react.js`, `react.css`, `theme.js` and the Mermaid entry revalidate with an ETag, so a rebuilt bundle is never served stale, and the HTML shell stays `no-store`.
- The first bundle no longer carries Markdown rendering and Shiki highlighting; they load when a page first shows Markdown, which cuts the first-load JavaScript from 1.52 MB to 1.0 MB before compression. If that chunk cannot be fetched, the page says Markdown could not be loaded and asks for a reload, while the rest of the Board keeps working.
- The HTML shell paints an outline of the header, sidebar and phone navigation in the saved theme before any script runs.
