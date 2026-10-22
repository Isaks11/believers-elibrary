> Status: Draft for beta readiness review — 2026-10-19

# Terms of Use — Believers e-Library

These terms cover the beta build of Believers e-Library, a Christian devotional and educational progressive web app. By using the app you accept these terms. If you do not accept them, do not use the app.

## 1. The service (beta)

- The app is in **beta**. Features, content, and availability may change, break, or be withdrawn without notice.
- The app currently operates largely **on-device**. Cloud sync is not fully active because the database schema has not yet been applied to the Supabase project; until then, data may not leave your device and may be lost if you clear browser storage without exporting a backup.
- You are responsible for exporting backups (Profile → Backup & Restore Data) of anything you want to keep.

## 2. Accounts

- When a Supabase backend is configured, you may register with an email address and password; you must confirm your email if email confirmation is enabled. When it is not configured, the app uses an explicitly labeled **device-local prototype account** stored only in your browser.
- You are responsible for keeping your credentials and device secure, and for all activity under your account.
- One account per person is expected; you may not impersonate others or misrepresent your affiliation.
- The optional journal PIN is a UI convenience, not a security feature (see `docs/PRIVACY_NOTICE.md`).

## 3. Acceptable use

You agree not to:

- Post or transmit content that is fraudulent, scam-related or financially soliciting, abusive, harassing, hateful, sexually explicit, or that violates any law.
- Attack persons rather than ideas; make doctrinal accusations against named individuals (prohibited content is detailed in `docs/COMMUNITY_GUIDELINES.md`).
- Share another person's private information (including prayer requests and medical/financial details shared with you in confidence).
- Circumvent rate limits, moderation, blocking, or access controls; probe or probe the backend; or attempt privilege escalation (including self-elevating your role).
- Scrape, resell, or republish app content (including Scripture, hymns, devotionals, and library items) except as permitted by `docs/CONTENT_LICENSING.md` and the rights holders.
- Introduce malware, spam, or automated bulk posting.

## 4. User content and ownership

- **You retain ownership** of everything you create in the app: journal entries, prayer requests, community posts and comments, reading plans, and any other submissions.
- You grant the app a non-exclusive, worldwide, royalty-free license to store, display, and transmit your content as needed to operate the service (e.g., publishing a community post to other users within its privacy scope).
- Public/community content is visible to other signed-in users according to its privacy scope; private journal and prayer content is intended to remain visible only to you (enforced by Row Level Security once the schema is applied).
- You are responsible for having the rights to any content you submit for publication in the e-library, devotionals, or news sections; contributor content requires a license/permission grant before publishing.

## 5. No warranty

- The app is provided **"as is" and "as available"**, without warranties of any kind, express or implied, including fitness for a particular purpose, accuracy, and uninterrupted availability.
- Scripture translations, hymns, devotional reflections, news, and library content are provided for **religious and educational purposes**. They may contain errors, and translations/summaries may differ from source texts.
- **The app is not a substitute for professional or pastoral counsel** — not for medical, mental-health, legal, financial, or crisis situations, and not for the discernment of qualified ministry leaders. If you are in crisis, contact local emergency services or a qualified professional.

## 6. Limitation of liability

To the maximum extent permitted by law, the operators and contributors of the app shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of data, revenue, or goodwill, arising from your use of (or inability to use) the app, including data lost from local browser storage, outages, or moderation decisions. The aggregate liability of the operators for any claim arising out of the app shall not exceed the greater of the amount you paid for the app (currently: nothing, the beta is free) or USD $100.

## 7. Termination and account deletion

- You may stop using the app at any time and may delete your account and personal data from Profile → Delete Account & Personal Data.
- **Known limitation:** deletion does not currently remove the Supabase Auth login row; the login may remain until an operator removes it (tracked as a pre-launch item).
- We may suspend or terminate access for violations of these terms or the Community Guidelines, using the moderation and blocking tools described in the app.
- Sections 4 (as to stored content), 5, 6, and 8 survive termination.

## 8. Governing principles and changes

- These terms are interpreted under general principles of good faith, user safety, and applicable law in the operator's jurisdiction; the operator's registered jurisdiction will be stated here before general release.
- We may update these terms during beta; the status line records the review date, and material changes will be announced in the app.
- If any provision is found unenforceable, the remainder stays in effect.

## 9. Beta disclaimer

This is a beta release intended for review, testing, and feedback. Features labeled experimental (including the "Faith Guide", which currently runs a clearly labeled **local curated concordance fallback rather than a live AI model**) may not behave as users expect. Do not rely on the app as your sole source of Scripture, counsel, or record-keeping during beta.
