import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

const cache_uri = 'file:///cache/inkwell/RecentEntries-test-account.json';
const cache_files = new Map();
let user_token = 'test-token';
const sync_requests = {
  read: mock(async () => []),
  unread: mock(async () => []),
  bookmark: mock(async () => []),
  unbookmark: mock(async () => []),
};
const fetch_entries = mock(async () => []);
const fetch_feed_entries = mock(async () => []);
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
    get_user_token: () => user_token,
  },
}));
mock.module('../api/MicroBlogFeeds', () => ({
  bookmark_micro_blog_feed_entries: sync_requests.bookmark,
  create_micro_blog_feed_subscription: mock(async () => null),
  create_micro_blog_bookmark: mock(async () => null),
  delete_micro_blog_feed_subscription: mock(async () => null),
  fetch_recap_email_settings: mock(async () => null),
  fetch_micro_blog_feed_entries: fetch_entries,
  fetch_micro_blog_feed_entries_for_feed: fetch_feed_entries,
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
  user_token = 'test-token';
  cache_files.clear();
  fetch_entries.mockReset();
  fetch_entries.mockImplementation(async () => []);
  fetch_feed_entries.mockReset();
  fetch_feed_entries.mockImplementation(async () => []);
  fetch_unread_ids.mockReset();
  fetch_unread_ids.mockImplementation(async () => []);
  fetch_starred_ids.mockReset();
  fetch_starred_ids.mockImplementation(async () => []);
  Object.values(sync_requests).forEach((request) => {
    request.mockReset();
    request.mockImplementation(async () => []);
  });
});

afterEach(() => Feed.reset());

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
    Object.keys(sync_requests).forEach((action) => {
      const local_key = action === 'bookmark' || action === 'unbookmark'
        ? `local_${action}ed_entry_ids`
        : `local_${action}_entry_ids`;
      expect([...Feed[local_key]]).toEqual([]);
    });
    expect(await Feed.persist_timeline_cache()).toBe(true);
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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolve_promise, reject_promise) => {
    resolve = resolve_promise;
    reject = reject_promise;
  });
  return { promise, resolve, reject };
}

function settle_sync() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function entry_payload() {
  return [{ id: '123', title: 'Test entry', created_at: new Date().toISOString() }];
}

function seed_entry(is_read = false, is_bookmarked = false) {
  Feed.apply_bootstrap_payload(
    [], is_read ? [] : ['123'], is_bookmarked ? ['123'] : [], entry_payload(), [],
  );
}

describe('local entry synchronization', () => {
  const scenarios = [
    { action: 'mark_entry_read', sync: 'read', field: 'is_read', initial: false, local: 'local_read_entry_ids' },
    { action: 'mark_entry_unread', sync: 'unread', field: 'is_read', initial: true, local: 'local_unread_entry_ids' },
    { action: 'bookmark_entry', sync: 'bookmark', field: 'is_bookmarked', initial: false, local: 'local_bookmarked_entry_ids' },
    { action: 'unbookmark_entry', sync: 'unbookmark', field: 'is_bookmarked', initial: true, local: 'local_unbookmarked_entry_ids' },
  ];

  scenarios.forEach(({ action, sync, field, initial, local }) => {
    it(`retires acknowledged ${sync} actions and respects subsequent remote changes`, async () => {
      const initial_read = field === 'is_read' ? initial : false;
      const initial_bookmark = field === 'is_bookmarked' ? initial : false;
      seed_entry(initial_read, initial_bookmark);

      expect(Feed[action]('123')).toBe(true);
      await settle_sync();
      expect([...Feed[local]]).toEqual([]);
      expect(await Feed.persist_timeline_cache()).toBe(true);
      expect(JSON.parse(cache_files.get(cache_uri))[local]).toEqual([]);

      seed_entry(initial_read, initial_bookmark);
      Feed.retry_unsynced_local_reads(initial_read ? [] : ['123']);
      Feed.retry_unsynced_local_bookmarks(initial_bookmark ? ['123'] : []);
      await settle_sync();
      expect(Feed.timeline_entry_snapshot('123')[field]).toBe(initial);
      expect(sync_requests[sync]).toHaveBeenCalledTimes(1);
    });

    it(`preserves failed ${sync} actions in the offline cache`, async () => {
      seed_entry(field === 'is_read' ? initial : false, field === 'is_bookmarked' ? initial : false);
      sync_requests[sync].mockImplementation(async () => { throw new Error('Offline'); });

      Feed[action]('123');
      await settle_sync();
      expect([...Feed[local]]).toEqual(['123']);
      await Feed.persist_timeline_cache();
      Feed.reset();
      await Feed.hydrate_timeline_cache();
      expect([...Feed[local]]).toEqual(['123']);
    });

    it(`does not let a stale refresh overwrite an acknowledged ${sync} action`, async () => {
      seed_entry(field === 'is_read' ? initial : false, field === 'is_bookmarked' ? initial : false);
      const entries = deferred();
      fetch_entries.mockImplementation(() => entries.promise);
      fetch_unread_ids.mockImplementation(async () => field === 'is_read' && initial ? [] : ['123']);
      fetch_starred_ids.mockImplementation(async () => field === 'is_bookmarked' && initial ? ['123'] : []);

      const refresh = Feed.bootstrap();
      await settle_sync();
      Feed[action]('123');
      await settle_sync();
      entries.resolve(entry_payload());
      expect(await refresh).toBe(true);
      expect([...Feed[local]]).toEqual([]);
      expect(Feed.timeline_entry_snapshot('123')[field]).toBe(!initial);
      expect(sync_requests[sync]).toHaveBeenCalledTimes(1);
    });
  });

  [
    { first: 'mark_entry_read', second: 'mark_entry_unread', sync: 'read', opposite: 'unread', field: 'is_read' },
    { first: 'bookmark_entry', second: 'unbookmark_entry', sync: 'bookmark', opposite: 'unbookmark', field: 'is_bookmarked' },
  ].forEach(({ first, second, sync, opposite, field }) => {
    it(`serializes ${sync} and ${opposite} so the latest tap wins`, async () => {
      seed_entry();
      const request = deferred();
      sync_requests[sync].mockImplementation(() => request.promise);
      Feed[first]('123');
      Feed[second]('123');
      expect(sync_requests[opposite]).toHaveBeenCalledTimes(0);

      request.resolve([]);
      await settle_sync();
      expect(sync_requests[opposite]).toHaveBeenCalledTimes(1);
      expect(Feed.timeline_entry_snapshot('123')[field]).toBe(false);
    });

    it(`coalesces ${sync}, ${opposite}, ${sync} while the first request is pending`, async () => {
      seed_entry();
      const request = deferred();
      sync_requests[sync].mockImplementation(() => request.promise);
      Feed[first]('123');
      Feed[second]('123');
      Feed[first]('123');

      request.resolve([]);
      await settle_sync();
      expect(sync_requests[sync]).toHaveBeenCalledTimes(1);
      expect(sync_requests[opposite]).toHaveBeenCalledTimes(0);
      expect(Feed.timeline_entry_snapshot('123')[field]).toBe(true);
    });
  });

  it('does not acknowledge a new session using an old request', async () => {
    seed_entry();
    const old_request = deferred();
    const new_request = deferred();
    sync_requests.read.mockImplementationOnce(() => old_request.promise);
    sync_requests.read.mockImplementationOnce(() => new_request.promise);
    Feed.mark_entry_read('123');
    Feed.reset();
    seed_entry();
    Feed.mark_entry_read('123');

    old_request.resolve([]);
    await settle_sync();
    expect([...Feed.local_read_entry_ids]).toEqual(['123']);
    expect([...Feed.pending_read_sync_entry_ids]).toEqual(['123']);
    new_request.resolve([]);
    await settle_sync();
    expect([...Feed.local_read_entry_ids]).toEqual([]);
  });

  it('does not acknowledge a request after the account token changes', async () => {
    seed_entry();
    const request = deferred();
    sync_requests.read.mockImplementation(() => request.promise);
    Feed.mark_entry_read('123');
    user_token = 'another-token';
    request.resolve([]);
    await settle_sync();
    expect([...Feed.local_read_entry_ids]).toEqual(['123']);
  });

  it('retires cached actions already confirmed by a fresh server snapshot', async () => {
    Feed.apply_timeline_cache_payload(build_cache_payload(2));
    Feed.retry_unsynced_local_reads(['unread']);
    Feed.retry_unsynced_local_bookmarks(['bookmark']);
    expect([...Feed.local_read_entry_ids]).toEqual([]);
    expect([...Feed.local_unread_entry_ids]).toEqual([]);
    expect([...Feed.local_bookmarked_entry_ids]).toEqual([]);
    expect([...Feed.local_unbookmarked_entry_ids]).toEqual([]);
    Object.values(sync_requests).forEach((request) => expect(request).toHaveBeenCalledTimes(0));
  });

  it('does not treat an older matching snapshot as acknowledgment of a newer failed action', async () => {
    seed_entry();
    const read_request = deferred();
    const entries = deferred();
    sync_requests.read.mockImplementation(() => read_request.promise);
    sync_requests.unread.mockImplementation(async () => { throw new Error('Offline'); });
    fetch_entries.mockImplementation(() => entries.promise);
    fetch_unread_ids.mockImplementation(async () => ['123']);

    Feed.mark_entry_read('123');
    const refresh = Feed.bootstrap();
    await settle_sync();
    Feed.mark_entry_unread('123');
    read_request.resolve([]);
    await settle_sync();
    entries.resolve(entry_payload());
    expect(await refresh).toBe(true);
    expect([...Feed.local_unread_entry_ids]).toEqual(['123']);
    expect(sync_requests.unread).toHaveBeenCalledTimes(1);
  });

  it('preserves acknowledged local state in an older subscription-feed response', async () => {
    seed_entry();
    const entries = deferred();
    fetch_feed_entries.mockImplementation(() => entries.promise);
    fetch_unread_ids.mockImplementation(async () => ['123']);
    const refresh = Feed.load_subscription_feed('feed-1');
    await settle_sync();
    Feed.mark_entry_read('123');
    Feed.bookmark_entry('123');
    await settle_sync();
    entries.resolve(entry_payload());

    expect(await refresh).toBe(true);
    expect(Feed.subscription_feed_entries[0].is_read).toBe(true);
    expect(Feed.subscription_feed_entries[0].is_bookmarked).toBe(true);
    expect([...Feed.local_read_entry_ids]).toEqual([]);
    expect([...Feed.local_bookmarked_entry_ids]).toEqual([]);
  });
});
