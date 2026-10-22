# Believers e-Library - Pilot Test Plan

**Phase 5** | Date: 2026-10-20 | Status: Ready for Testing

## Objectives
1. Validate core functionality on real devices (Android/iOS)
2. Test offline capabilities
3. Verify security boundaries (with backend configured)
4. Collect user feedback
5. Identify critical bugs before wider beta

## Prerequisites
- [ ] Supabase schema applied (Phase 4 blocker)
- [ ] HTTPS deployed or accessible via local network
- [ ] Test accounts created (2+ users for isolation testing)
- [ ] Test devices available (Android phone, iOS phone)

## Test Scenarios

### 1. Authentication & Profile
- [ ] Sign up with email/password
- [ ] Sign in/out
- [ ] Update profile name
- [ ] Guest mode limitations
- [ ] Admin access (only with VITE_ADMIN_EMAILS)

### 2. Bible Reading
- [ ] Navigate books/chapters
- [ ] Read verses
- [ ] Search functionality
- [ ] Bookmarks
- [ ] Reading history
- [ ] Offline access

### 3. Devotionals & Hymns
- [ ] View daily devotional
- [ ] Mark as completed
- [ ] Audio playback (if available)
- [ ] Hymn book browsing
- [ ] Favorites

### 4. Journal & Prayer
- [ ] Create journal entry
- [ ] Edit/delete entry
- [ ] Add prayer request
- [ ] Mark prayer as answered
- [ ] Search entries
- [ ] PIN protection
- [ ] Data persists on refresh

### 5. Library & Content
- [ ] Browse library
- [ ] View item details
- [ ] Download for offline (if supported)
- [ ] Reading progress

### 6. Community (if enabled)
- [ ] View feed
- [ ] Create post (respecting privacy/groups)
- [ ] Comment
- [ ] Report content
- [ ] Block user
- [ ] Group membership

### 7. Offline/PWA
- [ ] Install as PWA
- [ ] Use app offline
- [ ] Data syncs when online
- [ ] Service worker updates
- [ ] No private data cached

### 8. Security (Critical)
- [ ] Cannot access other user's data
- [ ] Cannot bypass admin restrictions
- [ ] PIN protects journal
- [ ] Rate limiting works
- [ ] Group-only content restricted

## Device Testing Matrix

| Device | OS | Browser | Status | Notes |
|--------|-----|---------|--------|-------|
| Android Phone | Android 10+ | Chrome | ☐ | Primary test |
| iPhone | iOS 14+ | Safari | ☐ | PWA install test |
| Tablet | Various | Chrome/Safari | ☐ | Responsive test |

## Bug Reporting
For each bug found:
- Device + OS + Browser
- Steps to reproduce
- Expected vs actual
- Screenshots/video
- Console errors (if possible)

## Success Criteria
- [ ] All critical flows work on real devices
- [ ] No data loss on refresh/offline
- [ ] Security boundaries enforced
- [ ] PWA installs and works offline
- [ ] No console errors in normal use
- [ ] Performance acceptable on 3G/4G

## Timeline
- Week 1: Internal testing
- Week 2: Fix critical bugs
- Week 3: Small pilot (2-5 users)
- Week 4: Review feedback and prepare for wider beta
