# Mai Linh đang ôn IELTS

A static IELTS Reading practice app designed for GitHub Pages or any free static host.

## Run locally

From this folder, use any static server, for example:

```bash
python -m http.server 4173
```

Then open `http://localhost:4173`.

Opening `index.html` directly is not recommended because browsers block the JSON fetch requests from `file://` pages.

## Deploy

Upload the `reading-exam` folder to a repository and enable GitHub Pages from the repository's Pages settings. The app fetches exam data from:

`https://github.com/thuypx09/ielts-source-reading`

All answers, timer state, bookmarks, notes, highlights, and imported progress are stored in the browser's local storage.
