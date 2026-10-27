---
"@shivaedev/github": minor
---

### Added

- Check-run creation and updates accept `detailsUrl`, and returned check runs decode the report link from `details_url`.
- List pages expose `hasNext`; `listBounded` returns decoded items and a `truncated` flag without fetching beyond its page cap.
