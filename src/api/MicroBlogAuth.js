import * as AuthSession from 'expo-auth-session';

export const MICRO_BLOG_AUTH_URL = 'https://micro.blog/indieauth/auth';
export const MICRO_BLOG_TOKEN_URL = 'https://micro.blog/indieauth/token';
export const MICRO_BLOG_VERIFY_URL = 'https://micro.blog/account/verify';
export const MICRO_BLOG_CLIENT_ID = 'https://micro.ink/client.json';
export const MICRO_BLOG_SCOPE = 'create';
export const MICRO_BLOG_REDIRECT_PATH = 'auth/callback';

export function get_micro_blog_redirect_uri() {
  return AuthSession.makeRedirectUri({
    scheme: 'inkwell',
    path: MICRO_BLOG_REDIRECT_PATH,
  });
}

export function build_micro_blog_auth_url({
  state,
  redirect_uri = get_micro_blog_redirect_uri(),
  client_id = MICRO_BLOG_CLIENT_ID,
} = {}) {
  const params = new URLSearchParams({
    client_id,
    scope: MICRO_BLOG_SCOPE,
    state,
    response_type: 'code',
    redirect_uri,
  });

  return `${MICRO_BLOG_AUTH_URL}?${params.toString()}`;
}

export function extract_micro_blog_callback_params(raw_url = '') {
  if (!raw_url) {
    return {
      code: '',
      state: '',
    };
  }

  try {
    const parsed_url = new URL(raw_url);

    return {
      code: parsed_url.searchParams.get('code')?.trim() || '',
      state: parsed_url.searchParams.get('state')?.trim() || '',
    };
  } catch (error) {
    return {
      code: '',
      state: '',
    };
  }
}

export function is_micro_blog_callback_url(raw_url = '') {
  if (!raw_url) {
    return false;
  }

  try {
    const parsed_url = new URL(raw_url);
    const matches_host_callback = parsed_url.host === 'auth' && parsed_url.pathname === '/callback';
    const matches_path_callback = parsed_url.pathname === '/auth/callback';

    return parsed_url.protocol === 'inkwell:' && (matches_host_callback || matches_path_callback);
  } catch (error) {
    return false;
  }
}

export async function exchange_micro_blog_code({
  code,
  redirect_uri = get_micro_blog_redirect_uri(),
  client_id = MICRO_BLOG_CLIENT_ID,
} = {}) {
  const body = new URLSearchParams({
    code,
    client_id,
    grant_type: 'authorization_code',
    redirect_uri,
  });

  const response = await fetch(MICRO_BLOG_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw create_request_error('Micro.blog token exchange failed.', response.status);
  }

  return response.json();
}

export async function verify_micro_blog_token(token = '') {
  const trimmed_token = `${token || ''}`.trim();

  if (!trimmed_token) {
    throw create_request_error('A Micro.blog token is required before verification.');
  }

  const body = new URLSearchParams({ token: trimmed_token });
  const response = await fetch(MICRO_BLOG_VERIFY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: `Bearer ${trimmed_token}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw create_request_error('Micro.blog verify failed.', response.status);
  }

  return response.json();
}

export function normalize_micro_blog_session(token_payload = null, verify_payload = null) {
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

function create_request_error(message, status = null) {
  const error = new Error(message);
  error.status = status;
  return error;
}
