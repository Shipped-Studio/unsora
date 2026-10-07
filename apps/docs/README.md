# Unsora Docs

The official documentation and API reference for [Unsora](https://app.tryunsora.com) — AI video, image, music, thumbnail, influencer, and clipping generation.

Built with [Mintlify](https://mintlify.com).

## Development

Install the [Mintlify CLI](https://www.npmjs.com/package/mint) to preview documentation changes locally:

```
npm i -g mint
```

Run the following command at the root of the docs (where `docs.json` lives):

```
mint dev
```

View your local preview at `http://localhost:3000`.

## Structure

- `docs.json` — navigation, theme, logo, and site config
- `get-started.mdx`, `api-guide.mdx` — guides
- `api-reference/` — endpoint reference pages
- `openapi.json` — OpenAPI spec that powers the API playground
- `logo/`, `images/`, `favicon.png` — branding assets

## Publishing changes

Pushing to the default branch deploys to Mintlify automatically (via the Mintlify GitHub app). The public docs are served at `tryunsora.com/docs`, proxied to the Mintlify deployment (`unsora.mintlify.app`) by a rewrite in the landing app's `next.config.ts`.

## Need help?

- If the dev server won't start: run `mint update` to get the latest CLI.
- If a page 404s: make sure you're running in a folder with a valid `docs.json`.
- [Mintlify documentation](https://mintlify.com/docs)
- Support: hi@tryunsora.com
