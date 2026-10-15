# YouTube publishing

## One-time setup (about 10 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project (e.g. "video-factory").
2. APIs & Services, Library: enable **YouTube Data API v3**.
3. APIs & Services, OAuth consent screen: choose **External**, fill in the app name and your email, and add your own Google account as a **test user**.
4. APIs & Services, Credentials: **Create credentials, OAuth client ID**, application type **Desktop app**.
5. Copy the client ID and secret into `.env`:

   ```
   YOUTUBE_CLIENT_ID=...
   YOUTUBE_CLIENT_SECRET=...
   ```

6. Run `npm run vf -- youtube-auth`, open the printed URL, choose the channel, approve. A refresh token is saved to `.secrets/youtube.json` (git-ignored, mode 600).

Run step 6 on a machine with a browser; the login redirects to a local port.

## What `vf publish` sets

| Field | From |
|---|---|
| Title, description, tags | `youtube.*` in the spec; description gets chapters and asset credits appended |
| Category | `youtube.categoryId` (27 = Education) |
| Privacy | `youtube.privacy` (default **private**) or `--privacy` |
| Made for kids | `youtube.madeForKids` |
| Altered or synthetic content | `youtube.containsSyntheticMedia`; `auto` turns it on when AI video is used |
| Thumbnail | `build/out/thumbnail.png` (re-encoded to JPEG if over 2 MB) |
| Captions | `build/out/captions.srt` as a caption track |
| Playlist | `youtube.playlistId` |

`build/out/published.json` records the upload, and publishing the same build twice is refused unless you pass `--force`.

## Limits you will hit

| Limit | Detail | What to do |
|---|---|---|
| Uploads stuck as private | Videos uploaded through an API project that hasn't passed Google's compliance audit are locked to private | Publish from YouTube Studio (you should review there anyway), or apply for the audit if you automate at scale |
| Daily quota | 10,000 units/day by default; an upload costs about 1,600, so roughly 6 uploads a day | Request more quota in Cloud Console if needed |
| Custom thumbnails | Need a phone-verified channel | Verify at youtube.com/verify |
| End screens | Not settable through the API | Add them in Studio over the outro, which reserves space for them |

## Policies to respect

**Inauthentic content.** YouTube's Partner Program excludes mass-produced, repetitive content, and it tightened that language in 2025. A factory makes it easy to cross that line. What keeps you on the right side: original research and a point of view in every script, your own voice (clone it with ElevenLabs), varied structure from video to video, and real editorial review. Templates are a production tool, not a content strategy.

**Altered or synthetic content disclosure.** Required when realistic content was made or meaningfully altered with AI: a real person saying or doing something they didn't, real events or places altered, or realistic scenes that never happened. Stylized illustrations and obviously animated graphics don't need it. Photoreal AI video usually does. The `auto` setting flags any video that uses AI video clips; set it explicitly if you know better.

**Made for kids.** If the video is for children, set `madeForKids: true`. That disables comments, end screens and personalized ads; mislabeling carries COPPA penalties.

**Music.** Use generated music (ElevenLabs, cleared on paid plans), the YouTube Audio Library, or a licensed library with your channel whitelisted, or you'll collect Content ID claims.

**Voice cloning.** Only clone voices you have permission to use. Yours is the safe and better choice.

## Packaging matters more than polish

Title and thumbnail decide click-through before anyone sees a frame. The planner writes a title under 70 characters and 2-5 words of thumbnail text; treat them as first drafts. Use YouTube's built-in thumbnail "Test & compare" with 2-3 variants:

```bash
npm run vf -- thumbnail projects/black-holes --text "Time Stops Here" --out thumb-a.png
npm run vf -- thumbnail projects/black-holes --text "Inside a Black Hole" --scene 4 --out thumb-b.png
```

Assets come from the cache, so variants only cost render time.
