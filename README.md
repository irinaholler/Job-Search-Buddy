# Job Search Buddy 🧭

A tiny browser-only helper for people who are tired of typing the same job titles into ten different portals.

You drop in your CV, Job Search Buddy reads it, suggests fitting roles, and opens ready-made searches on Indeed, StepStone, LinkedIn & custom portals – so you spend less time fiddling with search boxes and more time deciding _which_ offers are worth your energy.

> “From CV text to concrete job searches in a few clicks.”

---

## What this app does

### 1. CV in – profile out

- Paste your CV text **or** upload a **PDF**.
- The app uses `pdfjs` to read the PDF and a small parser to:
  - guess your **main directions** (frontend-heavy, fullstack, design-heavy, AI-heavy …),
  - collect **skills / keywords**,
  - generate a list of **job title suggestions** (one per line).

The job titles field is **fully editable** – it’s a starting point, not a prison.

---

### 2. One click → multiple job portals

For each job title, the app builds search URLs for:

- **Indeed** – classic `?q=title&l=location` search
- **StepStone** – clean, human-readable URLs like  
  `https://www.stepstone.de/jobs/frontend-developer/in-hannover`
- **LinkedIn** – title + a couple of skills + location

You can also add your **own portals**, for example:

- company career site
- niche job board
- freelancing marketplace

via URL templates like:

```txt
https://example.com/jobs?search={query}&city={location}
```
