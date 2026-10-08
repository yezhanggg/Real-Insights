# Launching on Vercel

The site is a static Vite build plus two Vercel functions. Free tiers cover it: Vercel Hobby, Buttondown free (up to 100 subscribers), and DeepSeek pay-as-you-go.

## 1. Put the repo on GitHub

```bash
git add -A && git commit -m "Vision REAL: first version"
gh repo create vision-real --public --source . --push     # or --private
```

`.env` is git-ignored, and so are `src/generated/` and the pipeline's downloads. Run `git status` before the first push to confirm no key is staged.

## 2. Create the Vercel project

Import the repo at vercel.com/new, or run `vercel` in the repo. `vercel.json` already sets the framework (Vite), the build command, the output folder, caching for `/data/*` and the SPA rewrites.

## 3. Environment variables

In Vercel → Project → Settings → Environment Variables (Production and Preview):

| Name | Needed for | Where to get it |
|---|---|---|
| `DEEPSEEK_API_KEY` | Ask the map | platform.deepseek.com → API keys |
| `DEEPSEEK_MODEL` | optional | `deepseek-flash` (default) or `deepseek-v4-pro` |
| `BUTTONDOWN_API_KEY` | Subscribe | buttondown.com → Settings → API |
| *or* `SUPABASE_URL` + `SUPABASE_SECRET_KEY` | Subscribe, if you keep your own list | Supabase → Project settings → API; run `supabase/migrations/0001_subscribers.sql` first |

None of these start with `VITE_`, so none reach the browser. `CENSUS_API_KEY` is only for the Python pipeline on your machine; Vercel doesn't need it.

## 4. Domain and site URL

Add a domain under Vercel → Domains, or keep `<project>.vercel.app`. Then update **`url:` in `content/site.yaml`** and the `Sitemap:` line in `public/robots.txt`. The RSS feed, the sitemap and share links use them.

## Subscribers and the "new map" email

**Buttondown (recommended).** It gives you a list, a sending address, unsubscribe links and an archive, all handled for you.

1. Create an account and a newsletter, then copy the API key into Vercel.
2. To announce new data, either:
   - **Write it yourself.** Buttondown → New email, with a few lines and a link to `/map/<dataset-id>`. This is the most personal option.
   - **Automate it.** Buttondown → Settings → RSS → add `https://<your-domain>/feed.xml`. Every new dataset then sends (or drafts) an email.
3. Sign-ups are tagged with where they came from (`subscribe`, `gate:/map/…`, `footer`).

**Supabase.** It stores emails in your own table; you send from any tool you like.

## 5. Launch checklist

- [ ] `npm run build` and `npm test` pass locally.
- [ ] Update `tagline`, `links` and `url` in `content/site.yaml`, and choose the `gate` setting (`map`, `data` or `off`).
- [ ] Publish the first real dataset (the example is dev-only).
- [ ] Add the env vars in Vercel and redeploy.
- [ ] Set `launched: true` in `content/site.yaml`. Until then the map and Insights show "Coming soon" and Subscribe collects the wait-list.
- [ ] On the live site: subscribe with your own email, open the map on your phone, ask the assistant one question.
- [ ] Optional: Vercel Web Analytics (Project → Analytics), which works with no code changes.

## Updating

Every `git push` to `main` deploys. A typical cycle:

1. Run the pipeline and publish a layer (`publish_layer.py`), then edit its YAML (title, `dek`, `about`, `updated`, optional `image`).
2. `npm run dev` and check it on the map and in Latest updates.
3. `git add -A && git commit -m "New data: <title>" && git push`.
4. Send the email (or let the RSS automation send it).
