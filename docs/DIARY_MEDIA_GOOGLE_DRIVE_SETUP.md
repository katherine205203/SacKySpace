# Diary media → Google Drive setup

The Diary media implementation uses the Vercel server function at `/api/diary-media`.
The browser only receives a signed resolver URL; Google credentials and the Drive file
ID stay server-side.

## Required server environment

Configure these variables in the server/runtime environment (not `VITE_*`):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_DRIVE_DIARY_FOLDER_ID=1O0FBfVs885riCq9klV3yLKWwm9v07NH8`
- `DIARY_MEDIA_SIGNING_SECRET`
- Either `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`, or the OAuth trio:
  `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, and `GOOGLE_DRIVE_REFRESH_TOKEN`.

The service account or OAuth identity must have Editor access to the dedicated Drive
folder. The integration does not fall back to Supabase Storage and does not report
success when these credentials are missing.

## Data boundary

`public.diary_media` stores only ownership, slot, Drive file ID, media key, source
type, optimized dimensions, MIME type, byte size, caption, and status. Image bytes
are uploaded to the configured Google Drive folder. The resolver streams the file
from Drive after validating the signed owner-bound URL.

## Verification checklist

1. Configure the server-only variables above.
2. Start the app and attach a local JPEG/PNG/WebP in Diary.
3. Confirm the UI moves through selected → compressing → uploading → saved.
4. Confirm the optimized file appears in the dedicated Drive folder.
5. Confirm the matching `diary_media` row contains metadata and `drive_file_id`, not binary data.
6. Reload Diary, read the entry, and open it from Journey Quick View.
7. Exercise URL import, four-slot limit, replacement/removal, and a failed upload.

This pass intentionally stops before commit, push, or deploy for owner review.
