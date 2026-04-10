import { flow, types } from 'mobx-state-tree';

function normalize_micro_blog_session(token_payload = null, verify_payload = null) {
  const profile = token_payload?.profile || {};

  return {
    profile_name:
      `${verify_payload?.username || verify_payload?.name || profile?.name || ''}`.trim() || null,
    profile_url:
      `${verify_payload?.url || profile?.url || token_payload?.me || verify_payload?.me || ''}`.trim() || null,
    profile_photo:
      `${verify_payload?.avatar || verify_payload?.photo || profile?.photo || ''}`.trim() || null,
    me: `${token_payload?.me || verify_payload?.me || profile?.url || ''}`.trim() || null,
    token_scope: `${token_payload?.scope || ''}`.trim() || null,
    has_inkwell:
      typeof verify_payload?.has_inkwell === 'boolean' ? verify_payload.has_inkwell : null,
    is_using_ai:
      typeof verify_payload?.is_using_ai === 'boolean' ? verify_payload.is_using_ai : null,
  };
}

function resolve_token_sign_in_error_message(error) {
  if (error?.status === 401 || error?.status === 403) {
    return 'That Micro.blog token is not valid. Please try again.';
  } else {
    return 'We could not sign you in with that token. Please try again.';
  }
}

export function create_auth_store({
  build_micro_blog_auth_url,
  create_oauth_state,
  exchange_micro_blog_code,
  extract_micro_blog_callback_params,
  get_initial_url,
  get_micro_blog_redirect_uri,
  is_micro_blog_callback_url,
  open_auth_session,
  tokens,
  verify_micro_blog_token,
} = {}) {
  return types
    .model('Auth', {
      is_hydrating: types.optional(types.boolean, false),
      is_signing_in: types.optional(types.boolean, false),
      loading_phase: types.optional(types.string, 'idle'),
      error_message: types.maybeNull(types.string),
      profile_name: types.maybeNull(types.string),
      profile_url: types.maybeNull(types.string),
      profile_photo: types.maybeNull(types.string),
      me: types.maybeNull(types.string),
      token_scope: types.maybeNull(types.string),
      has_inkwell: types.maybeNull(types.boolean),
      is_using_ai: types.maybeNull(types.boolean),
    })
    .actions(self => ({
      clear_error() {
        self.error_message = null;
      },

      set_error(message = null) {
        self.error_message = message;
      },

      set_loading_phase(phase = 'idle') {
        const trimmed_phase = `${phase || ''}`.trim();

        if (trimmed_phase === 'connecting' || trimmed_phase === 'verifying') {
          self.loading_phase = trimmed_phase;
        } else {
          self.loading_phase = 'idle';
        }
      },

      clear_session_data() {
        self.profile_name = null;
        self.profile_url = null;
        self.profile_photo = null;
        self.me = null;
        self.token_scope = null;
        self.has_inkwell = null;
        self.is_using_ai = null;
      },

      apply_session_payloads(token_payload = null, verify_payload = null) {
        const next_session = normalize_micro_blog_session(token_payload, verify_payload);
        self.profile_name = next_session.profile_name;
        self.profile_url = next_session.profile_url;
        self.profile_photo = next_session.profile_photo;
        self.me = next_session.me;
        self.token_scope = next_session.token_scope;
        self.has_inkwell = next_session.has_inkwell;
        self.is_using_ai = next_session.is_using_ai;
      },

      hydrate: flow(function* () {
        if (self.is_hydrating) {
          return;
        }

        self.is_hydrating = true;
        self.clear_error();

        try {
          yield tokens.hydrate();

          const initial_url = yield get_initial_url();
          if (self.can_handle_auth_callback(initial_url) && tokens.has_pending_oauth_state()) {
            self.set_loading_phase('verifying');
            yield self.complete_sign_in_callback(initial_url);
            self.is_hydrating = false;
            return;
          }

          const stored_token = tokens.get_user_token();
          if (!stored_token) {
            self.clear_session_data();
            self.is_hydrating = false;
            return;
          }

          try {
            self.set_loading_phase('verifying');
            const verify_payload = yield verify_micro_blog_token(stored_token);
            self.apply_session_payloads(null, verify_payload);
          } catch (error) {
            if (error?.status === 401 || error?.status === 403) {
              yield self.clear_invalid_session('Your Micro.blog session expired. Please sign in again.');
            }
          }
        } finally {
          self.is_hydrating = false;
          self.set_loading_phase();
        }
      }),

      sign_in_with_micro_blog: flow(function* () {
        if (self.is_loading()) {
          return false;
        }

        self.clear_error();
        self.is_signing_in = true;
        self.set_loading_phase('connecting');

        try {
          yield tokens.hydrate();

          const oauth_state = yield create_oauth_state();
          if (!oauth_state) {
            self.set_error('We could not prepare Micro.blog sign in. Please try again.');
            return false;
          }

          yield tokens.set_pending_oauth_state(oauth_state);

          const redirect_uri = get_micro_blog_redirect_uri();
          const auth_url = build_micro_blog_auth_url({
            state: oauth_state,
            redirect_uri,
          });

          const auth_result = yield open_auth_session(auth_url, redirect_uri);

          if (auth_result?.type === 'success' && auth_result?.url) {
            return yield self.complete_sign_in_callback(auth_result.url);
          }

          yield tokens.clear_pending_oauth_state();

          if (auth_result?.type === 'cancel' || auth_result?.type === 'dismiss') {
            self.clear_error();
          } else {
            self.set_error('Micro.blog sign in did not complete. Please try again.');
          }

          return false;
        } catch (error) {
          yield tokens.clear_pending_oauth_state();
          self.set_error('We could not open Micro.blog sign in. Please try again.');
          return false;
        } finally {
          self.finish_sign_in();
        }
      }),

      sign_in_with_token: flow(function* (token = '') {
        if (self.is_loading()) {
          return false;
        }

        const trimmed_token = `${token || ''}`.trim();
        self.clear_error();

        if (!trimmed_token) {
          self.set_error('Enter a Micro.blog token to sign in.');
          return false;
        }

        self.is_signing_in = true;
        self.set_loading_phase('verifying');

        try {
          yield tokens.hydrate();

          const verify_payload = yield verify_micro_blog_token(trimmed_token);
          yield tokens.set_user_token(trimmed_token);
          self.apply_session_payloads(null, verify_payload);
          self.clear_error();
          return true;
        } catch (error) {
          yield tokens.clear_user_token();
          self.clear_session_data();
          self.set_error(resolve_token_sign_in_error_message(error));
          return false;
        } finally {
          self.finish_sign_in();
        }
      }),

      complete_sign_in_callback: flow(function* (raw_url = '') {
        self.set_loading_phase('verifying');
        const { code, state } = extract_micro_blog_callback_params(raw_url);
        const expected_state = tokens.get_pending_oauth_state();

        yield tokens.clear_pending_oauth_state();

        if (!code) {
          self.set_error('Micro.blog did not return an authorization code. Please try again.');
          return false;
        }

        if (!state || !expected_state || state !== expected_state) {
          self.set_error('Micro.blog sign in could not be verified. Please try again.');
          return false;
        }

        try {
          const token_payload = yield exchange_micro_blog_code({ code });
          const access_token = `${token_payload?.access_token || ''}`.trim();

          if (!access_token) {
            throw new Error('Micro.blog did not return an access token.');
          }

          yield tokens.set_user_token(access_token);
          self.apply_session_payloads(token_payload, null);

          try {
            const verify_payload = yield verify_micro_blog_token(access_token);
            self.apply_session_payloads(token_payload, verify_payload);
          } catch (error) {
            if (error?.status === 401 || error?.status === 403) {
              yield self.clear_invalid_session('Your Micro.blog session expired. Please sign in again.');
              return false;
            }
          }

          self.clear_error();
          return true;
        } catch (error) {
          yield tokens.clear_user_token();
          self.clear_session_data();
          self.set_error('We could not finish signing you in. Please try again.');
          return false;
        } finally {
          if (!self.is_hydrating) {
            self.set_loading_phase();
          }
        }
      }),

      clear_invalid_session: flow(function* (message = null) {
        yield tokens.clear_all();
        self.clear_session_data();
        self.set_error(message);
        self.set_loading_phase();
      }),

      sign_out: flow(function* () {
        yield tokens.clear_all();
        self.clear_session_data();
        self.clear_error();
        self.set_loading_phase();
      }),

      finish_sign_in() {
        self.is_signing_in = false;
        self.set_loading_phase();
      },
    }))
    .views(self => ({
      is_loading() {
        return self.is_hydrating || self.is_signing_in;
      },

      is_signed_in() {
        return tokens.has_user_token();
      },

      can_handle_auth_callback(raw_url = '') {
        return is_micro_blog_callback_url(raw_url);
      },

      current_profile() {
        return {
          name: self.profile_name || '',
          url: self.profile_url || self.me || '',
          photo: self.profile_photo || '',
          has_inkwell: self.has_inkwell,
          is_using_ai: self.is_using_ai,
        };
      },
    }))
    .create();
}
