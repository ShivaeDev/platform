export const layout = `
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.65 var(--sans); }
a { color: var(--link); }
button, select { font: inherit; color: inherit; }
button, select, summary { cursor: pointer; }
button, select { padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--card); }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
.skip { position: fixed; top: -100px; left: 16px; z-index: 5; padding: 8px 16px; background: var(--card); }
.skip:focus { top: 8px; }
.workspace { display: grid; grid-template-columns: 248px minmax(0, 1fr); min-height: 100vh; }
:root[data-sidebar="closed"] .workspace { grid-template-columns: minmax(0, 1fr); }
.sidebar { --focus: #e2bc79; position: sticky; top: 0; align-self: start; height: 100vh; overflow-y: auto; padding: var(--space) 16px; background: var(--sidebar); color: var(--sidebar-text); }
.sidebar[hidden] { display: none; }
.brand { display: block; padding: 0 12px 28px; font-size: 24px; font-weight: 600; letter-spacing: -0.8px; text-decoration: none; color: var(--sidebar-text); }
.brand span { display: block; margin-top: 4px; font-size: 12px; font-weight: 400; letter-spacing: 0; color: var(--sidebar-muted); }
.sidebar .nav-heading { margin: 0 12px 12px; font: 600 12px var(--sans); color: var(--sidebar-muted); }
.files { font-size: 14px; }
.files ul { list-style: none; margin: 0 0 10px; padding: 0; }
.files li { display: flex; align-items: baseline; gap: 8px; margin: 0; padding: 4px 10px; border-radius: 5px; }
.files li:has(a[aria-current="page"]) { background: #385242; }
.files a { flex: 1; min-width: 0; color: var(--sidebar-text); text-decoration: none; overflow-wrap: anywhere; }
.files a:hover, .files a[aria-current="page"] { text-decoration: underline; text-underline-offset: 4px; }
.files details { margin: 8px 0; }
.files summary { padding: 6px 10px; color: var(--sidebar-muted); overflow-wrap: anywhere; }
.files details ul { margin-left: 14px; border-left: 1px solid var(--sidebar-border); }
.age { color: var(--muted); font: 12px var(--mono); margin-left: 6px; white-space: nowrap; }
.files .age { color: var(--sidebar-muted); margin: 0; flex-shrink: 0; }
.page { min-width: 0; }
.bar { display: flex; align-items: center; gap: 16px; padding: 16px var(--space); border-bottom: 1px solid var(--border); font-size: 13px; }
.bar button { flex-shrink: 0; }
.breadcrumbs { display: flex; flex-wrap: wrap; gap: 6px 10px; flex: 1; min-width: 0; overflow-wrap: anywhere; }
.breadcrumbs > span:not(.separator) { min-width: 0; }
.separator { color: var(--muted); }
.live { color: var(--muted); font: 12px/1.9 var(--mono); }
.live[data-state="down"], .live[data-state="stale"] { color: var(--danger); }
.preferences { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 12px; align-items: center; padding: 14px var(--space) 0; color: var(--muted); font-size: 12px; }
.preference { display: flex; gap: 8px; align-items: center; }
#preference-status:empty { display: none; }
#doc { padding: var(--space) var(--space) 64px; min-width: 0; }
.document-view { max-width: calc(72ch + 2 * var(--space)); margin-inline: auto; }
.board-view { max-width: 1600px; margin-inline: auto; }
.meta { color: var(--muted); font-size: 13px; margin: 0; overflow-wrap: anywhere; }
.meta .age { margin: 0; }
@media (max-width: 760px) {
  .workspace { grid-template-columns: minmax(0, 1fr); }
  .sidebar { position: static; height: auto; max-height: 42vh; border-bottom: 1px solid var(--border); }
  .brand { padding-bottom: 16px; }
  .bar { flex-wrap: wrap; gap: 12px; }
  .breadcrumbs { flex-basis: calc(100% - 100px); }
  .live { margin-left: auto; }
  .preferences { justify-content: flex-start; }
  :root { --space: 18px; }
}
`;
const light = `
  color-scheme: light;
  --bg: #f7f8f4; --surface: #edf1e7; --card: #ffffff; --text: #263c34; --muted: #596957;
  --border: #d5dfd0; --link: #315f45; --danger: #a03024; --focus: #976323;
  --sidebar: #203a30; --sidebar-text: #e7eee2; --sidebar-muted: #b6c8ad; --sidebar-border: #4a624c;
`;
const dark = `
  color-scheme: dark;
  --bg: #18251f; --surface: #26382d; --card: #203027; --text: #e7eee2; --muted: #b0c1a6;
  --border: #455a48; --link: #b1d4a1; --danger: #ffafa2; --focus: #e2bc79;
  --sidebar: #142219; --sidebar-text: #e7eee2; --sidebar-muted: #b6c8ad; --sidebar-border: #455a48;
`;

export const theme = `
:root {
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  --space: 24px; --card-space: 20px;
  ${light}
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${dark} } }
:root[data-theme="dark"] { ${dark} }
:root[data-density="compact"] { --space: 16px; --card-space: 12px; }
`;
