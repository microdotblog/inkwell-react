import { describe, expect, it, mock } from 'bun:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from '@babel/core';
import * as mst from 'mobx-state-tree';

function compile(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  return transformSync(source, {
    configFile: false,
    babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
}

const code = compile('./MicroBlogFeeds.js');
const bookmarks_code = compile('../stores/Bookmarks.js');

function load_api(responder, {
  read_text = async (payload) => JSON.stringify(payload),
  set_timeout = setTimeout,
  clear_timeout = clearTimeout,
} = {}) {
  const fetch = mock(async (url, options) => {
    const payload = await responder(url, options);
    return { ok: true, text: () => read_text(payload) };
  });
  const context = {
    exports: {}, URL, URLSearchParams, Headers, AbortController, fetch,
    setTimeout: set_timeout, clearTimeout: clear_timeout,
    require: () => ({ MICRO_BLOG_AUTH_URL: 'https://micro.blog' }),
  };
  // Isolate the transport from the Feed store's module-level API mocks.
  vm.runInNewContext(code, context);
  return { ...context.exports, fetch };
}

function load_bookmarks(api) {
  const context = {
    exports: {}, URL,
    require(name) {
      if (name === 'mobx-state-tree') return mst;
      if (name === './Tokens') return { hydrate: async () => {}, get_user_token: () => 'test-token' };
      return api;
    },
  };
  vm.runInNewContext(bookmarks_code, context);
  return context.exports.default;
}

function items(start, count) {
  return Array.from({ length: count }, (_, index) => ({ id: `${start + index}` }));
}

describe('bookmark pagination', () => {
  it('requests one page at a time using Favorite-specific cursors', async () => {
    const pages = [items(1, 25), items(26, 24).concat({ id: 'f50' })];
    const api = load_api((_url, options) => {
      expect(options.headers.get('Authorization')).toBe('Bearer test-token');
      return { title: 'Bookmarks', items: pages.shift() };
    });
    const payload = await api.fetch_micro_blog_bookmarks({ token: 'test-token' });
    expect(payload.items).toHaveLength(25);
    expect(payload.title).toBe('Bookmarks');
    expect(payload.next_before_id).toBe('f25');
    expect(api.fetch).toHaveBeenCalledTimes(1);
    const next = await api.fetch_micro_blog_bookmarks({
      token: 'test-token', before_id: payload.next_before_id,
    });
    expect(next.next_before_id).toBe('f50');
    expect(api.fetch.mock.calls.map(([url]) => url.pathname + url.search)).toEqual([
      '/posts/bookmarks',
      '/posts/bookmarks?before_id=f25',
    ]);
  });

  it('shows the first page before the next response and prefetches at most three more pages', async () => {
    const { promise: second_requested, resolve: did_request_second } = Promise.withResolvers();
    const { promise: second_response, resolve: finish_second } = Promise.withResolvers();
    const api = load_api((url) => {
      const cursor = url.searchParams.get('before_id');
      if (cursor === 'f25') {
        did_request_second();
        return second_response;
      }
      return { items: items(cursor ? Number(cursor.slice(1)) + 1 : 1, 25) };
    });
    const bookmarks = load_bookmarks(api);
    const load = bookmarks.load();
    await second_requested;
    expect(bookmarks.bookmark_entries()).toHaveLength(25);
    expect(bookmarks.has_loaded).toBe(true);
    expect(bookmarks.is_loading).toBe(false);
    finish_second({ items: items(26, 25) });
    expect(await load).toBe(true);
    expect(bookmarks.bookmark_entries()).toHaveLength(100);
    expect(api.fetch.mock.calls.map(([url]) => url.searchParams.get('before_id')))
      .toEqual([null, 'f25', 'f50', 'f75']);
  });

  it('keeps loaded pages during a stalled response body and retries from the failed cursor', async () => {
    const { promise: reading_stalled_body, resolve: did_start_body } = Promise.withResolvers();
    const set_timeout = mock(() => 1);
    const clear_timeout = mock(() => {});
    let should_stall = true;
    const api = load_api((url) => {
      const before = Number(url.searchParams.get('before_id')?.slice(1) || 0);
      if (should_stall && before === 50) {
        should_stall = false;
        return null;
      }
      return { items: items(before + 1, 25) };
    }, {
      set_timeout, clear_timeout,
      read_text: async (payload) => {
        if (payload === null) {
          did_start_body();
          return new Promise(() => {});
        }
        return JSON.stringify(payload);
      },
    });
    const bookmarks = load_bookmarks(api);
    const load = bookmarks.load();
    await reading_stalled_body;
    const [expire, timeout_ms] = set_timeout.mock.calls[2];
    expect(timeout_ms).toBe(15000);
    expire();
    expect(await load).toBe(false);
    expect(api.fetch.mock.calls[2][1].signal.aborted).toBe(true);
    expect(clear_timeout).toHaveBeenCalledTimes(3);
    expect(bookmarks.bookmark_entries()).toHaveLength(50);
    expect(bookmarks.is_loading).toBe(false);
    expect(bookmarks.did_fail_older_page).toBe(true);
    expect(bookmarks.error_message).toBe('Micro.blog took too long to respond.');

    expect(await bookmarks.retry()).toBe(true);
    expect(bookmarks.bookmark_entries()).toHaveLength(100);
    expect(bookmarks.error_message).toBeNull();
    expect(api.fetch.mock.calls.map(([url]) => url.searchParams.get('before_id')))
      .toEqual([null, 'f25', 'f50', 'f50', 'f75']);
  });

  it('stops prefetching if the bookmarks server repeats a page', async () => {
    const api = load_api(() => ({ items: items(1, 25) }));
    const bookmarks = load_bookmarks(api);
    expect(await bookmarks.load()).toBe(true);
    expect(bookmarks.bookmark_entries()).toHaveLength(25);
    expect(api.fetch).toHaveBeenCalledTimes(2);
  });

  it('ignores an older page that finishes after a new refresh', async () => {
    const { promise: older_requested, resolve: did_request_older } = Promise.withResolvers();
    const { promise: older_response, resolve: finish_older } = Promise.withResolvers();
    let first_page_count = 0;
    const api = load_api((url) => {
      const before_id = url.searchParams.get('before_id');
      if (!before_id) {
        return { items: items(++first_page_count === 1 ? 1 : 100, 25) };
      }
      if (before_id === 'f25') {
        did_request_older();
        return older_response;
      }
      return { items: [] };
    });
    const bookmarks = load_bookmarks(api);
    const load = bookmarks.load();
    await older_requested;
    expect(await bookmarks.refresh()).toBe(true);
    finish_older({ items: items(26, 25) });
    expect(await load).toBe(false);
    expect(new Set(bookmarks.bookmark_entries().map((entry) => entry.id)))
      .toEqual(new Set(items(100, 25).map((entry) => entry.id)));
  });
});

describe('highlight pagination', () => {
  it('loads all highlight pages using the advertised total', async () => {
    const api = load_api((url) => {
      const offset = Number(url.searchParams.get('offset'));
      expect(url.searchParams.get('limit')).toBe('100');
      return { _microblog: { count: 203 }, items: items(offset + 1, Math.min(100, 203 - offset)) };
    });
    const payload = await api.fetch_micro_blog_highlights();
    expect(payload.items).toHaveLength(203);
    expect(api.fetch.mock.calls.map(([url]) => url.searchParams.get('offset'))).toEqual(['0', '100', '200']);
  });

  it('uses the raw page length for highlight offsets while deduplicating overlaps', async () => {
    const pages = [items(1, 100), items(100, 100)];
    const api = load_api(() => ({ _microblog: { count: 200 }, items: pages.shift() }));
    expect((await api.fetch_micro_blog_highlights()).items).toHaveLength(199);
    expect(api.fetch).toHaveBeenCalledTimes(2);
  });

  it('handles empty collections and stops on repeated highlight pages', async () => {
    const empty_api = load_api(() => ({ items: [] }));
    expect((await empty_api.fetch_micro_blog_highlights()).items).toEqual([]);
    expect((await empty_api.fetch_micro_blog_bookmarks()).items).toEqual([]);
    const repeating_api = load_api(() => ({ items: items(1, 100) }));
    expect((await repeating_api.fetch_micro_blog_highlights()).items).toHaveLength(100);
    expect(repeating_api.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not replace a saved collection with a partial response after a later-page failure', async () => {
    let page = 0;
    const api = load_api(() => {
      if (page++ > 0) {
        throw new Error('Offline');
      }
      return { items: items(1, 100) };
    });
    await expect(api.fetch_micro_blog_highlights()).rejects.toThrow('Offline');
  });
});
