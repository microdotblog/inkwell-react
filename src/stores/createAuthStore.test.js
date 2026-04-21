import { describe, expect, it, mock } from 'bun:test';

import { create_auth_store } from './createAuthStore';

function build_tokens_double() {
  return {
    hydrate: mock(async () => {}),
    set_user_token: mock(async token => token),
    clear_user_token: mock(async () => {}),
    set_pending_oauth_state: mock(async state => state),
    clear_pending_oauth_state: mock(async () => {}),
    clear_all: mock(async () => {}),
    get_user_token() {
      return '';
    },
    has_user_token() {
      return false;
    },
    get_pending_oauth_state() {
      return '';
    },
    has_pending_oauth_state() {
      return false;
    },
  };
}

function build_auth_store(overrides = {}) {
  const default_tokens = build_tokens_double();
  const dependencies = {
    build_micro_blog_auth_url: mock(() => 'https://micro.blog/auth'),
    exchange_micro_blog_code: mock(async () => ({ access_token: 'oauth-token' })),
    extract_micro_blog_callback_params: mock(() => ({ code: '', state: '' })),
    get_initial_url: mock(async () => null),
    get_micro_blog_redirect_uri: mock(() => 'inkwell://auth/callback'),
    is_micro_blog_callback_url: mock(() => false),
    open_auth_session: mock(async () => ({ type: 'cancel' })),
    tokens: default_tokens,
    verify_micro_blog_token: mock(async token => ({
      avatar: 'https://micro.blog/avatar.jpg',
      has_inkwell: true,
      is_premium: true,
      is_using_ai: false,
      me: 'https://micro.blog/vincent',
      url: 'https://micro.blog/vincent',
      username: `verified-${token}`,
    })),
    ...overrides,
  };

  return {
    dependencies,
    store: create_auth_store(dependencies),
    tokens: dependencies.tokens,
  };
}

describe('create_auth_store', () => {
  describe('sign_in_with_token', () => {
    it('stores the replacement token from verify and applies the verified profile', async () => {
      const replacement_token = 'session-token-456';
      const { dependencies, store, tokens } = build_auth_store();
      dependencies.verify_micro_blog_token.mockImplementation(async token => ({
        avatar: 'https://micro.blog/avatar.jpg',
        has_inkwell: true,
        is_premium: true,
        is_using_ai: false,
        me: 'https://micro.blog/vincent',
        token: replacement_token,
        url: 'https://micro.blog/vincent',
        username: `verified-${token}`,
      }));

      const did_sign_in = await store.sign_in_with_token('  token-123  ');

      expect(did_sign_in).toBe(true);
      expect(dependencies.verify_micro_blog_token).toHaveBeenCalledWith('token-123');
      expect(tokens.set_user_token).toHaveBeenCalledWith(replacement_token);
      expect(store.profile_name).toBe('verified-token-123');
      expect(store.profile_url).toBe('https://micro.blog/vincent');
      expect(store.profile_photo).toBe('https://micro.blog/avatar.jpg');
      expect(store.has_inkwell).toBe(true);
      expect(store.is_premium).toBe(true);
      expect(store.is_using_ai).toBe(false);
      expect(store.error_message).toBe(null);
      expect(store.is_signing_in).toBe(false);
      expect(store.loading_phase).toBe('idle');
    });

    it('falls back to the submitted token when verify does not return a replacement token', async () => {
      const { store, tokens } = build_auth_store();

      const did_sign_in = await store.sign_in_with_token('token-123');

      expect(did_sign_in).toBe(true);
      expect(tokens.set_user_token).toHaveBeenCalledWith('token-123');
    });

    it('stores the verified AI flag', async () => {
      const { store } = build_auth_store({
        verify_micro_blog_token: mock(async token => ({
          avatar: 'https://micro.blog/avatar.jpg',
          has_inkwell: true,
          is_premium: true,
          is_using_ai: true,
          me: 'https://micro.blog/vincent',
          url: 'https://micro.blog/vincent',
          username: `verified-${token}`,
        })),
      });

      const did_sign_in = await store.sign_in_with_token('token-123');

      expect(did_sign_in).toBe(true);
      expect(store.is_using_ai).toBe(true);
    });

    it('rejects an invalid token without persisting it', async () => {
      const invalid_token_error = new Error('Invalid token');
      invalid_token_error.status = 401;

      const { store, tokens } = build_auth_store({
        verify_micro_blog_token: mock(async () => {
          throw invalid_token_error;
        }),
      });

      const did_sign_in = await store.sign_in_with_token('bad-token');

      expect(did_sign_in).toBe(false);
      expect(tokens.set_user_token).not.toHaveBeenCalled();
      expect(tokens.clear_user_token).toHaveBeenCalled();
      expect(store.profile_name).toBe(null);
      expect(store.error_message).toBe('That Micro.blog token is not valid. Please try again.');
      expect(store.is_signing_in).toBe(false);
      expect(store.loading_phase).toBe('idle');
    });

    it('rejects accounts without Inkwell access', async () => {
      const { store, tokens } = build_auth_store({
        verify_micro_blog_token: mock(async () => ({
          has_inkwell: false,
          url: 'https://micro.blog/vincent',
          username: 'vincent',
        })),
      });

      const did_sign_in = await store.sign_in_with_token('token-123');

      expect(did_sign_in).toBe(false);
      expect(tokens.set_user_token).not.toHaveBeenCalled();
      expect(tokens.clear_user_token).toHaveBeenCalled();
      expect(store.error_message).toBe('Inkwell requires a Micro.blog subscription.');
      expect(store.profile_name).toBe(null);
    });
  });

  describe('hydrate', () => {
    it('replaces the stored token when verify returns a newer session token', async () => {
      const { store, tokens } = build_auth_store({
        tokens: {
          ...build_tokens_double(),
          get_user_token() {
            return 'stored-token';
          },
          has_user_token() {
            return true;
          },
        },
        verify_micro_blog_token: mock(async () => ({
          token: 'fresh-token',
          url: 'https://micro.blog/vincent',
          username: 'vincent',
        })),
      });

      await store.hydrate();

      expect(tokens.set_user_token).toHaveBeenCalledWith('fresh-token');
      expect(store.profile_name).toBe('vincent');
    });

    it('clears stored sessions when verify shows Inkwell is unavailable', async () => {
      const { store, tokens } = build_auth_store({
        tokens: {
          ...build_tokens_double(),
          get_user_token() {
            return 'stored-token';
          },
          has_user_token() {
            return true;
          },
        },
        verify_micro_blog_token: mock(async () => ({
          has_inkwell: false,
          url: 'https://micro.blog/vincent',
          username: 'vincent',
        })),
      });

      await store.hydrate();

      expect(tokens.clear_all).toHaveBeenCalled();
      expect(store.error_message).toBe('Inkwell requires a Micro.blog subscription.');
      expect(store.profile_name).toBe(null);
    });
  });
});
