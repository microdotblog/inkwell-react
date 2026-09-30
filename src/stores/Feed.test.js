import { beforeEach, describe, expect, it, mock } from 'bun:test';

const cache_uri = 'file:///cache/inkwell/RecentEntries-test-account.json';
const cache_files = new Map();
const sync_requests = {
  read: mock(async () => []),
  unread: mock(async () => []),
  bookmark: mock(async () => []),
  unbookmark: mock(async () => []),
};
const fetch_entries = mock(async () => []);
const fetch_unread_ids = mock(async () => []);
const fetch_starred_ids = mock(async () => []);

mock.module('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  digestStringAsync: mock(async () => 'test-account'),
}));
mock.module('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  getInfoAsync: mock(async (uri) => ({
    exists: uri === 'file:///cache/inkwell' || cache_files.has(uri),
  })),
  makeDirectoryAsync: mock(async () => {}),
  readAsStringAsync: mock(async (uri) => cache_files.get(uri)),
  writeAsStringAsync: mock(async (uri, contents) => {
    cache_files.set(uri, contents);
  }),
  deleteAsync: mock(async (uri) => cache_files.delete(uri)),
}));
mock.module('react-native', () => ({
  Platform: { OS: 'ios' },
  Settings: { get: () => false, set: () => {} },
}));
mock.module('./Tokens', () => ({
  default: {
    hydrate: mock(async () => {}),
    get_user_token: () => 'test-token',
  },
}));
mock.module('../api/MicroBlogFeeds', () => ({
  bookmark_micro_blog_feed_entries: sync_requests.bookmark,
  create_micro_blog_feed_subscription: mock(async () => null),
  create_micro_blog_bookmark: mock(async () => null),
  delete_micro_blog_feed_subscription: mock(async () => null),
  fetch_recap_email_settings: mock(async () => null),
  fetch_micro_blog_feed_entries: fetch_entries,
  fetch_micro_blog_feed_entries_for_feed: mock(async () => []),
  fetch_micro_blog_feed_icons: mock(async () => []),
  fetch_micro_blog_feed_starred_entry_ids: fetch_starred_ids,
  fetch_micro_blog_feed_subscriptions: mock(async () => []),
  fetch_micro_blog_feed_unread_entry_ids: fetch_unread_ids,
  mark_micro_blog_feed_entries_read: sync_requests.read,
  mark_micro_blog_feed_entries_unread: sync_requests.unread,
  summarize_micro_blog_feed_entries: mock(async () => ''),
  unbookmark_micro_blog_feed_entries: sync_requests.unbookmark,
  update_micro_blog_feed_subscription: mock(async () => null),
  update_recap_email_settings: mock(async () => null),
}));

const { default: Feed } = await import('./Feed');

function build_cache_payload(version = 1) {
  return {
    version,
    entries: [{
      id: 'read',
      title: 'Stale entry snapshot',
      published_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      is_read: true,
      is_bookmarked: false,
      age_bucket: 'day-1',
    }],
    local_read_entry_ids: ['read', 'outside-timeline'],
    local_unread_entry_ids: ['unread'],
    local_bookmarked_entry_ids: ['bookmark'],
    local_unbookmarked_entry_ids: ['unbookmark'],
  };
}

function expect_local_actions() {
  expect([...Feed.local_read_entry_ids]).toEqual(['read', 'outside-timeline']);
  expect([...Feed.local_unread_entry_ids]).toEqual(['unread']);
  expect([...Feed.local_bookmarked_entry_ids]).toEqual(['bookmark']);
  expect([...Feed.local_unbookmarked_entry_ids]).toEqual(['unbookmark']);
}

beforeEach(() => {
  Feed.reset();
  cache_files.clear();
  fetch_entries.mockReset();
  fetch_entries.mockImplementation(async () => []);
  fetch_unread_ids.mockReset();
  fetch_unread_ids.mockImplementation(async () => []);
  fetch_starred_ids.mockReset();
  fetch_starred_ids.mockImplementation(async () => []);
  Object.values(sync_requests).forEach((request) => {
    request.mockReset();
    request.mockImplementation(async () => []);
  });
});

describe('timeline cache migration', () => {
  it('restores v1 local actions without restoring stale snapshots', async () => {
    cache_files.set(cache_uri, JSON.stringify(build_cache_payload()));

    expect(await Feed.hydrate_timeline_cache()).toBe(true);
    expect(Feed.has_checked_timeline_cache).toBe(true);
    expect(Feed.timeline_entries.length).toBe(0);
    expect_local_actions();
  });

  it('preserves migrated actions through an offline bootstrap and a v2 save/reload', async () => {
    cache_files.set(cache_uri, JSON.stringify(build_cache_payload()));
    fetch_entries.mockImplementation(async () => {
      throw new Error('Offline');
    });

    expect(await Feed.bootstrap()).toBe(false);
    expect_local_actions();
    expect(Feed.timeline_entries.length).toBe(0);
    expect(await Feed.persist_timeline_cache()).toBe(true);
    expect(JSON.parse(cache_files.get(cache_uri))).toMatchObject({
      ...build_cache_payload(),
      version: 2,
      entries: [],
    });

    Feed.reset();
    expect(await Feed.hydrate_timeline_cache()).toBe(true);
    expect_local_actions();
    expect(Feed.timeline_entries.length).toBe(0);
  });

  it('overrides server state and retries all migrated actions after reconnecting', async () => {
    cache_files.set(cache_uri, JSON.stringify(build_cache_payload()));
    const created_at = new Date().toISOString();
    const published = new Date(Date.now() + 3 * 86400000).toISOString();
    fetch_entries.mockImplementation(async () => {
      return ['read', 'unread', 'bookmark', 'unbookmark'].map((id) => ({
        id,
        title: 'Fresh entry',
        published,
        created_at,
      }));
    });
    fetch_unread_ids.mockImplementation(async () => ['read', 'outside-timeline']);
    fetch_starred_ids.mockImplementation(async () => ['unbookmark']);

    expect(await Feed.bootstrap()).toBe(true);
    expect(fetch_entries).toHaveBeenCalledWith({
      token: 'test-token',
      existing_entry_ids: [],
    });
    expect(Feed.timeline_entry_snapshot('read').is_read).toBe(true);
    expect(Feed.timeline_entry_snapshot('unread').is_read).toBe(false);
    expect(Feed.timeline_entry_snapshot('bookmark').is_bookmarked).toBe(true);
    expect(Feed.timeline_entry_snapshot('unbookmark').is_bookmarked).toBe(false);
    expect(Feed.timeline_entry_snapshot('read').title).toBe('Fresh entry');
    expect(Feed.timeline_entry_snapshot('read').published_at).toBe(created_at);
    expect(sync_requests.read).toHaveBeenCalledWith({
      token: 'test-token', entry_ids: ['read', 'outside-timeline'],
    });
    expect(sync_requests.unread).toHaveBeenCalledWith({
      token: 'test-token', entry_ids: ['unread'],
    });
    expect(sync_requests.bookmark).toHaveBeenCalledWith({
      token: 'test-token', entry_ids: ['bookmark'],
    });
    expect(sync_requests.unbookmark).toHaveBeenCalledWith({
      token: 'test-token', entry_ids: ['unbookmark'],
    });
    expect_local_actions();
    expect(JSON.parse(cache_files.get(cache_uri)).version).toBe(2);
  });

  it('keeps migrated actions when their retry requests fail', async () => {
    cache_files.set(cache_uri, JSON.stringify(build_cache_payload()));
    fetch_unread_ids.mockImplementation(async () => ['read', 'outside-timeline']);
    fetch_starred_ids.mockImplementation(async () => ['unbookmark']);
    Object.values(sync_requests).forEach((request) => {
      request.mockImplementation(async () => {
        throw new Error('Sync failed');
      });
    });

    expect(await Feed.bootstrap()).toBe(true);
    expect_local_actions();
    Object.values(sync_requests).forEach((request) => {
      expect(request).toHaveBeenCalledTimes(1);
    });

    Feed.reset();
    expect(await Feed.hydrate_timeline_cache()).toBe(true);
    expect_local_actions();
  });

  it('continues restoring current-version entry snapshots and local actions', () => {
    expect(Feed.apply_timeline_cache_payload(build_cache_payload(2))).toBe(true);
    expect(Feed.timeline_entry_snapshot('read').title).toBe('Stale entry snapshot');
    expect_local_actions();
  });

  it('normalizes v1 ID lists and tolerates missing lists', () => {
    const payload = build_cache_payload();
    payload.local_read_entry_ids = [' read ', 'read', '', 42];
    delete payload.local_unread_entry_ids;
    payload.local_bookmarked_entry_ids = null;
    payload.local_unbookmarked_entry_ids = 'unbookmark';

    expect(Feed.apply_timeline_cache_payload(payload)).toBe(true);
    expect([...Feed.local_read_entry_ids]).toEqual(['read', '42']);
    expect([...Feed.local_unread_entry_ids]).toEqual([]);
    expect([...Feed.local_bookmarked_entry_ids]).toEqual([]);
    expect([...Feed.local_unbookmarked_entry_ids]).toEqual([]);
    expect(Feed.timeline_entries.length).toBe(0);
  });

  it('continues rejecting unknown versions and malformed payloads', () => {
    [null, {}, build_cache_payload(0), build_cache_payload(3), {
      ...build_cache_payload(2), entries: null,
    }].forEach((payload) => {
      expect(Feed.apply_timeline_cache_payload(payload)).toBe(false);
      expect(Feed.has_restored_cache).toBe(false);
      expect(Feed.timeline_entries.length).toBe(0);
      expect([...Feed.local_read_entry_ids]).toEqual([]);
    });
  });
});
