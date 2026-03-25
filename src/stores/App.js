import { AppState, Appearance, Platform, ToastAndroid } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { flow, types } from 'mobx-state-tree';

import {
  DEFAULT_ACCENT_PALETTE_ID,
  normalizeAccentPaletteId,
} from '../theme/authTheme';
import {
  DEFAULT_TEXT_SCALE,
  normalizeTextScale,
} from '../theme/textScale';
import Auth from './Auth';

const APP_PREFERENCES_STORAGE_KEY = 'AppPreferences';
const DEFAULT_TOAST_DURATION_MS = 1800;
const ANDROID_LONG_TOAST_THRESHOLD_MS = 3000;

const AppStore = types
  .model('App', {
    theme: types.optional(types.string, 'light'),
    accent_palette_id: types.optional(types.string, DEFAULT_ACCENT_PALETTE_ID),
    text_scale: types.optional(types.number, DEFAULT_TEXT_SCALE),
    is_hydrating: types.optional(types.boolean, true),
    toast_duration_ms: types.optional(types.number, DEFAULT_TOAST_DURATION_MS),
    toast_key: types.optional(types.number, 0),
    toast_message: types.optional(types.maybeNull(types.string), null),
    toast_top_offset: types.optional(types.maybeNull(types.number), null),
  })
  .volatile(() => ({
    app_state_subscription: null,
    appearance_subscription: null,
    did_start: false,
    toast_timeout_id: null,
  }))
  .actions(self => ({
    set_theme(theme = 'light') {
      self.theme = theme === 'dark' ? 'dark' : 'light';
    },

    apply_accent_palette(accent_palette_id = DEFAULT_ACCENT_PALETTE_ID) {
      self.accent_palette_id = normalizeAccentPaletteId(accent_palette_id);
    },

    apply_text_scale(text_scale = DEFAULT_TEXT_SCALE) {
      self.text_scale = normalizeTextScale(text_scale);
    },

    sync_current_theme() {
      const color_scheme = Appearance.getColorScheme();
      self.set_theme(color_scheme);
    },

    start_theme_listener() {
      if (self.app_state_subscription || self.appearance_subscription) {
        return;
      }

      self.sync_current_theme();

      self.app_state_subscription = AppState.addEventListener('change', next_app_state => {
        if (next_app_state === 'active') {
          self.sync_current_theme();
        }
      });

      self.appearance_subscription = Appearance.addChangeListener(({ colorScheme }) => {
        self.set_theme(colorScheme);
      });
    },

    stop_theme_listener() {
      self.app_state_subscription?.remove();
      self.appearance_subscription?.remove();
      self.app_state_subscription = null;
      self.appearance_subscription = null;
    },

    clear_toast_timer() {
      if (!self.toast_timeout_id) {
        return;
      }

      clearTimeout(self.toast_timeout_id);
      self.toast_timeout_id = null;
    },

    clear_toast() {
      self.clear_toast_timer();
      self.toast_duration_ms = DEFAULT_TOAST_DURATION_MS;
      self.toast_message = null;
      self.toast_top_offset = null;
    },

    show_toast(
      message = '',
      duration_or_options = DEFAULT_TOAST_DURATION_MS,
      next_options = {},
    ) {
      const toast_options = normalize_toast_options(
        duration_or_options,
        next_options,
      );
      const normalized_message = `${message || ''}`.trim();
      const normalized_duration_ms = normalize_toast_duration(
        toast_options.duration_ms,
      );
      const normalized_top_offset = normalize_toast_top_offset(
        toast_options.top_offset,
      );

      self.clear_toast_timer();
      self.toast_duration_ms = normalized_duration_ms;
      self.toast_key += 1;
      self.toast_top_offset = normalized_top_offset;

      if (!normalized_message) {
        self.toast_message = null;
        self.toast_top_offset = null;
        return false;
      }

      if (Platform.OS === 'android') {
        self.toast_message = null;
        self.toast_top_offset = null;
        ToastAndroid.show(
          normalized_message,
          normalized_duration_ms >= ANDROID_LONG_TOAST_THRESHOLD_MS
            ? ToastAndroid.LONG
            : ToastAndroid.SHORT,
        );
        return true;
      }

      self.toast_message = normalized_message;
      self.toast_timeout_id = setTimeout(() => {
        self.clear_toast();
      }, normalized_duration_ms);

      return true;
    },

    hydrate_preferences: flow(function* () {
      try {
        const data = yield SecureStore.getItemAsync(APP_PREFERENCES_STORAGE_KEY);

        if (!data) {
          self.apply_accent_palette(DEFAULT_ACCENT_PALETTE_ID);
          self.apply_text_scale(DEFAULT_TEXT_SCALE);
          return;
        }

        const parsed_preferences = JSON.parse(data);
        self.apply_accent_palette(parsed_preferences?.accent_palette_id);
        self.apply_text_scale(parsed_preferences?.text_scale);
      } catch (error) {
        self.apply_accent_palette(DEFAULT_ACCENT_PALETTE_ID);
        self.apply_text_scale(DEFAULT_TEXT_SCALE);
      }
    }),

    persist_preferences: flow(function* () {
      const normalized_palette_id = normalizeAccentPaletteId(self.accent_palette_id);
      const normalized_text_scale = normalizeTextScale(self.text_scale);

      if (
        normalized_palette_id === DEFAULT_ACCENT_PALETTE_ID &&
        normalized_text_scale === DEFAULT_TEXT_SCALE
      ) {
        yield SecureStore.deleteItemAsync(APP_PREFERENCES_STORAGE_KEY);
        return;
      }

      yield SecureStore.setItemAsync(
        APP_PREFERENCES_STORAGE_KEY,
        JSON.stringify({
          accent_palette_id: normalized_palette_id,
          text_scale: normalized_text_scale,
        }),
      );
    }),

    set_accent_palette: flow(function* (accent_palette_id = DEFAULT_ACCENT_PALETTE_ID) {
      const normalized_palette_id = normalizeAccentPaletteId(accent_palette_id);

      if (self.accent_palette_id === normalized_palette_id) {
        return self.accent_palette_id;
      }

      self.apply_accent_palette(normalized_palette_id);
      yield self.persist_preferences();
      return self.accent_palette_id;
    }),

    set_text_scale: flow(function* (text_scale = DEFAULT_TEXT_SCALE) {
      self.apply_text_scale(text_scale);
      yield self.persist_preferences();
      return self.text_scale;
    }),

    hydrate: flow(function* () {
      self.is_hydrating = true;

      try {
        yield self.hydrate_preferences();
        yield Auth.hydrate();
      } finally {
        self.is_hydrating = false;
      }
    }),

    start: flow(function* () {
      if (self.did_start) {
        return;
      }

      self.did_start = true;
      self.start_theme_listener();
      yield self.hydrate();
    }),

    stop() {
      self.did_start = false;
      self.clear_toast();
      self.stop_theme_listener();
    },
  }))
  .views(self => ({
    is_dark_mode() {
      return self.theme === 'dark';
    },
  }))
  .create();

export default AppStore;

function normalize_toast_duration(duration_ms = DEFAULT_TOAST_DURATION_MS) {
  const parsed_duration_ms = Number(duration_ms);

  if (!Number.isFinite(parsed_duration_ms)) {
    return DEFAULT_TOAST_DURATION_MS;
  }

  return Math.max(Math.round(parsed_duration_ms), 1000);
}

function normalize_toast_top_offset(top_offset = null) {
  const parsed_top_offset = Number(top_offset);

  if (!Number.isFinite(parsed_top_offset)) {
    return null;
  }

  return Math.max(Math.round(parsed_top_offset), 0);
}

function normalize_toast_options(
  duration_or_options = DEFAULT_TOAST_DURATION_MS,
  next_options = {},
) {
  if (
    duration_or_options &&
    typeof duration_or_options === 'object' &&
    !Array.isArray(duration_or_options)
  ) {
    return duration_or_options;
  }

  return {
    ...(next_options && typeof next_options === 'object' ? next_options : {}),
    duration_ms: duration_or_options,
  };
}
