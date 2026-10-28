import { describe, expect, it, mock } from 'bun:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from '@babel/core';

const source = readFileSync(new URL('./MicroBlogFeeds.js', import.meta.url), 'utf8');
const { code } = transformSync(source, {
  configFile: false,
  babelrc: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});

function load_api(responder) {
  const fetch = mock(async (url, options) => {
    const payload = await responder(url, options);
    return { ok: true, text: async () => JSON.stringify(payload) };
  });
  const context = {
    exports: {}, URL, URLSearchParams, Headers, fetch,
    require: () => ({ MICRO_BLOG_AUTH_URL: 'https://micro.blog' }),
  };
  // Isolate the transport from the Feed store's module-level API mocks.
  vm.runInNewContext(code, context);
  return { ...context.exports, fetch };
}

function items(start, count) {
  return Array.from({ length: count }, (_, index) => ({ id: `${start + index}` }));
}

describe('saved-item pagination', () => {
  it('loads bookmarks beyond the first page using Favorite-specific cursors', async () => {
    const pages = [items(1, 25), items(25, 25), items(50, 3), []];
    const api = load_api((_url, options) => {
      expect(options.headers.get('Authorization')).toBe('Bearer test-token');
      return { title: 'Bookmarks', items: pages.shift() };
    });
    const payload = await api.fetch_micro_blog_bookmarks({ token: 'test-token' });
    expect(payload.items).toHaveLength(52);
    expect(payload.title).toBe('Bookmarks');
    expect(api.fetch.mock.calls.map(([url]) => url.pathname + url.search)).toEqual([
      '/posts/bookmarks',
      '/posts/bookmarks?before_id=f25',
      '/posts/bookmarks?before_id=f49',
      '/posts/bookmarks?before_id=f52',
    ]);
  });

  it('does not loop forever if a bookmarks server repeats a page', async () => {
    const api = load_api(() => ({ items: items(1, 25) }));
    expect((await api.fetch_micro_blog_bookmarks()).items).toHaveLength(25);
    expect(api.fetch).toHaveBeenCalledTimes(2);
  });

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
