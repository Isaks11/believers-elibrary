> Status: Draft for beta readiness review — 2026-10-19

# Community Guidelines — Believers e-Library

These guidelines describe how the app's community features are actually moderated today. They apply to posts, comments, and group participation.

## 1. Post categories

Every post must pick one of the four implemented categories:

| Category | Use it for |
|---|---|
| `testimony` | Personal stories of faith and grace |
| `scripture_reflection` | Notes on a passage (optionally with a Scripture reference) |
| `prayer_request` | Requests for prayer |
| `question` | Questions for the community |

Post bodies are limited to 3–2000 characters; comments to 2–1000 (enforced in the database schema).

## 2. Privacy scopes

| Scope | Who can see the post |
|---|---|
| Private prayer list | Only you — personal prayer requests live in the Journal, never published |
| `group_only` | Members of that group only |
| `community_public` | All signed-in community members |

- Post in the narrowest scope that fits. Ask yourself before posting: *would I be comfortable if everyone saw this?*
- Never repost someone's group-only content elsewhere. Never share personal details (medical, financial, family) about another person without consent — that includes details disclosed in prayer requests.

## 3. Anonymity — plain statement

Anonymous posting is **display-level only**:

- The database stores `author_id` (your real user id) server-side on every post and comment, plus an `is_anonymous` flag and a display `author_name`.
- Other members see the anonymous display name; admins and the database still know who authored the content.
- Anonymity is for candor within these guidelines — **not** a shield for rule-breaking. Treat posting anonymously as posting under your account.

## 4. Reporting

Any signed-in user can report a post or a comment. Reasons, exactly as implemented:

| Reason | Meaning |
|---|---|
| `harassment` | Attacks, intimidation, or hostile targeting of a person |
| `false_teaching_spam` | Spam or disruptive content |
| `privacy_violation` | Shares private personal/medical details |
| `scam_solicitation` | Financial solicitation or scam link |
| `other` | Anything else (free text detail field available) |

**What happens after a report:**

1. The report enters the moderation queue with status `pending`.
2. The content is flagged (`flagged`) while under review.
3. An admin resolves it as **removed** (content set to `removed` and hidden from feeds) or **dismissed** (report closed, content restored to `active`).
4. Only admins can view and resolve the queue (enforced by Row Level Security once the schema is applied).

Reports are not a debating tool; filing reports in bad faith is itself a violation.

## 5. Blocking

- You can block specific authors; their content is hidden from your feeds, and you stop seeing their posts/comments.
- Blocking is personal (stored per user) — it does not delete their content for everyone else.
- Do not encourage others to evade blocks or pile onto a blocked user.

## 6. Rate limits

- **1 post and 1 comment per 10 seconds per user** (cooldown enforced client-side in `src/data/communityData.ts`).
- Use the cooldown to slow down pile-ons and spam; bypassing it (automation, multiple accounts) is prohibited.

## 7. Prohibited content

- Scams, fraud, or financial solicitation (including "seed offering" style requests, investment pitches, payment links).
- Abuse, threats, harassment, hate speech, or bullying of any person.
- Sexually explicit, violent, or illegal content.
- Doctrinal attacks **on persons** — critique ideas and passages, not named believers; secondary differences between denominations are to be treated with respect.
- Doxxing or publishing anyone's private information.
- Misinformation presented as official app content, impersonation, and off-topic commercial promotion.

## 8. Moderator and admin responsibilities

- Admins are granted by the operator via the `VITE_ADMIN_EMAILS` allow-list plus the `admin` role in the `profiles` table; RLS — not the frontend — is the real enforcement.
- Admins: review the report queue promptly, apply the remove/dismiss decision consistently, document reasons, and never use moderation to settle personal or doctrinal disputes.
- Admins must not read private journals or prayer lists; moderation covers community posts, comments, and reports only.
- Admins are bound by these guidelines too; conduct complaints about an admin go to the operator directly.

## 9. Appeals

- If your content is removed or your account is restricted, you may appeal once by contacting the operator (repository issue or the deployment operator's contact channel) with the post/report reference.
- Appeals are reviewed by someone other than the original decision-maker where staffing allows; during beta, responses are best-effort and may be slow.
- Disagreement with doctrine-based moderation decisions is not by itself grounds for reinstatement; inconsistent or biased decisions are.

Violations may result in content removal, flagging, blocking, or account termination (see `docs/TERMS_OF_USE.md`).
