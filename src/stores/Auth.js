import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

import {
  build_micro_blog_auth_url,
  exchange_micro_blog_code,
  extract_micro_blog_callback_params,
  get_micro_blog_redirect_uri,
  is_micro_blog_callback_url,
  verify_micro_blog_token,
} from '../api/MicroBlogAuth';
import Tokens from './Tokens';
import { create_auth_store } from './createAuthStore';

async function create_oauth_state() {
  const state_bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(state_bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

const Auth = create_auth_store({
  build_micro_blog_auth_url,
  create_oauth_state,
  exchange_micro_blog_code,
  extract_micro_blog_callback_params,
  get_initial_url() {
    return Linking.getInitialURL();
  },
  get_micro_blog_redirect_uri,
  is_micro_blog_callback_url,
  open_auth_session(auth_url, redirect_uri) {
    return WebBrowser.openAuthSessionAsync(auth_url, redirect_uri);
  },
  tokens: Tokens,
  verify_micro_blog_token,
});

export {
  create_auth_store,
  MICRO_BLOG_SUBSCRIPTION_REQUIRED_MESSAGE,
} from './createAuthStore';
export default Auth;
