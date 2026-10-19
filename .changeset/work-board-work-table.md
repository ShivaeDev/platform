---
"@shivaedev/work-board": patch
---

### Changed

- The Table view is a sortable data table: click a column header to sort by it, click again to reverse, and each row is headed by a link to the item with its ID underneath. Saved views keep the sort direction.
- All work and Table share one toolbar with a search box and Status, Owner, Board and Sort menus, plus a Reset link while a filter applies.
- All work heads each status group with a count badge.
- Now lanes mark empty lanes, keep Done collapsed until opened, show Fleet outages in one notice, and on a phone show one lane at a time behind lane tabs. Long card lists now scroll inside their lane instead of leaving blank space.
- The sidebar's Now count is the number of open cards on the Now page: queued, executing, reviewing, delivering and waiting work, using Fleet stages when Fleet is available.
- Done in the last 7 days sits under the lanes as a one-line disclosure.
- The work page heading names the selected view: Now, All work or Table.
- Filter links drop empty parameters, so shared URLs stay short.
