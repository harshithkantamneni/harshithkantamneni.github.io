# harshithkantamneni.github.io

Personal site for Harshith Kantamneni, live at [harshithkantamneni.github.io](https://harshithkantamneni.github.io).

It's a static site. Pushing to `main` deploys the `site/` folder to GitHub Pages.

## Structure

```
site/          what gets deployed
tools/home/    sources for the home page
tools/         build_pages.py builds /work/, /60/ and /numbers/; check_*.py are the checks
data/          claims.json holds every number with its conditions and source; work/ holds the write-ups
```

`site/numbers/num.js` and the fonts, Lenis and PDFs under `site/` are edited or added directly.

## Build and check

Run from the repo root:

```bash
python3 tools/home/build.py
python3 tools/build_pages.py
python3 tools/check_claims.py
python3 tools/check_site.py
python3 -m http.server 4321 --directory site
```
