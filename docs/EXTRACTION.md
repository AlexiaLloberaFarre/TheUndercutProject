# Extracting the OneNote notebooks

The notebooks live in OneDrive for Business under
`Documents/Bloc de notas de OneNote/`, which means the Microsoft Graph OneNote
API can read them. That is the route this repo uses.

## Why not the Claude Microsoft 365 connector

Worth knowing so nobody retries it. The connector is authenticated to this
account and can *find* the notebooks — SharePoint's search index even returns
extracted text snippets from the `.one` files. But it cannot read a page:

- Its granted Graph scopes are `Files.Read.All`, `Sites.Read.All`, `Mail.*`,
  `Calendars.*`, `Chat*`. There is no `Notes.Read`, so the OneNote API is closed
  to it.
- Reading a `.one` file directly through the files API is refused:
  `MIME type 'application/msonenote' is not allowed`.
- Search snippets are truncated mid-sentence and elided, so they are useful for
  reconnaissance and useless as a source of record.

So extraction needs its own app registration with `Notes.Read`. Setting that up
is a one-time cost of about fifteen minutes.

## One-time setup

1. Go to the [Azure portal](https://portal.azure.com) → **Microsoft Entra ID** →
   **App registrations** → **New registration**.
2. Name it anything (`undercut-onenote-export`). Under *Supported account
   types*, pick the option that covers this work account. Leave the redirect URI
   blank.
3. On the new app's **Authentication** blade, set **Allow public client flows**
   to **Yes**. The device-code flow will not work without this.
4. On **API permissions** → **Add a permission** → **Microsoft Graph** →
   **Delegated permissions** → add **`Notes.Read`**. If the tenant requires
   admin consent, an admin has to grant it here.
5. Copy the **Application (client) ID** from the Overview blade.

```bash
pip install -r requirements.txt
export ONENOTE_CLIENT_ID='<the client id>'
```

No client secret is needed — this is a public client using device-code auth.
The refresh token is cached at `~/.cache/undercut/msal_token_cache.json`
(mode 0600) so only the first run is interactive.

## Running it

Take stock before downloading anything. This makes roughly one call per section
and writes `docs/inventory.json`:

```bash
python tools/onenote_export.py --inventory
```

Then export for real:

```bash
python tools/onenote_export.py                          # everything
python tools/onenote_export.py --notebook 'Formula E'   # one notebook
python tools/onenote_export.py --no-binaries            # text only, much faster
python tools/onenote_export.py --since-last-run         # incremental
```

The first run prints a device code and a URL to paste it into. Later runs are
silent.

### Incremental sync

Every exported page is recorded in `notes/.manifest.json` with its
`lastModifiedDateTime`. A page whose timestamp is unchanged is skipped, so
`--since-last-run` after a race weekend only fetches what you actually touched.
Delete the manifest to force a full re-export.

## What comes out

```
notes/<notebook>/<section-group…>/<section>/NNN-<page-title>.md
notes/<notebook>/<section-group…>/<section>/assets/…
```

Each file carries YAML front matter — see [SCHEMA.md](SCHEMA.md).

## Known limits

**Handwriting does not become text.** Ink comes back as a rendered image and
nothing more; the API has no transcription. Pages containing ink are flagged
`has_ink: true` in their front matter and counted in the run summary, so they
are easy to list:

```bash
grep -rl 'has_ink: true' notes/
```

Transcribing those is a separate vision pass over the saved images, not part of
this export.

**Reading order is reconstructed, not given.** OneNote's API emits one
absolutely positioned block per text box in arbitrary order.
`tools/convert.py` sorts them by their `(top, left)` coordinates, which is
right for notes laid out in columns or stacked blocks. A page where boxes
overlap or sit side by side may still interleave — spot-check the busiest pages
rather than assuming.

**Graph throttles.** Page content is one call per page, and a few hundred pages
will hit HTTP 429 at least once. The client honours `Retry-After` and backs off
up to six attempts, so a large export is slow rather than fragile. Re-running
after an interruption resumes from the manifest.
