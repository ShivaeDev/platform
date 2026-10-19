---
"@shivaedev/work-board": patch
---

### Changed

- The goal chart labels each row with its criterion text, cut to fit, and links it to that criterion's card. The "All work" row is gone, since the progress bar above already shows it.
- Counts sit on the bars, so a phone reader no longer needs the tooltip. A segment too narrow for its number leaves it to the tooltip.
- A criterion without linked work stays in the chart as an empty row that says "No linked work".
- The chart shows a focus ring when it has keyboard focus, and its labels use the foreground color in both themes.
- The chart and Recharts load only on a goal page that shows the chart, which cuts the first bundle from 1.45 MB to 1.08 MB before compression. A skeleton holds the chart's height while it loads. If the chunk cannot be fetched, the page says so and asks for a reload; progress and criteria stay readable.
