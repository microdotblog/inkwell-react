import { AppState, Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { flow, types } from 'mobx-state-tree';

import {
  DEFAULT_ACCENT_PALETTE_ID,
  normalizeAccentPaletteId,
} from '../theme/authTheme';
import Auth from './Auth';

const APP_PREFERENCES_STORAGE_KEY = 'AppPreferences';

const AppStore = types
  .model('App', {
    theme: types.optional(types.string, 'light'),
    accent_palette_id: types.optional(types.string, DEFAULT_ACCENT_PALETTE_ID),
    is_hydrating: types.optional(types.boolean, true),
  })
  .volatile(() => ({
    app_state_subscription: null,
    appearance_subscription: null,
    did_start: false,
  }))
  .actions(self => ({
    set_theme(theme = 'light') {
      self.theme = theme === 'dark' ? 'dark' : 'light';
    },

    apply_accent_palette(accent_palette_id = DEFAULT_ACCENT_PALETTE_ID) {
      self.accent_palette_id = normalizeAccentPaletteId(accent_palette_id);
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

    hydrate_preferences: flow(function* () {
      try {
        const data = yield SecureStore.getItemAsync(APP_PREFERENCES_STORAGE_KEY);

        if (!data) {
          self.apply_accent_palette(DEFAULT_ACCENT_PALETTE_ID);
          return;
        }

        const parsed_preferences = JSON.parse(data);
        self.apply_accent_palette(parsed_preferences?.accent_palette_id);
      } catch (error) {
        self.apply_accent_palette(DEFAULT_ACCENT_PALETTE_ID);
      }
    }),

    persist_preferences: flow(function* () {
      const normalized_palette_id = normalizeAccentPaletteId(self.accent_palette_id);

      if (normalized_palette_id === DEFAULT_ACCENT_PALETTE_ID) {
        yield SecureStore.deleteItemAsync(APP_PREFERENCES_STORAGE_KEY);
        return;
      }

      yield SecureStore.setItemAsync(
        APP_PREFERENCES_STORAGE_KEY,
        JSON.stringify({
          accent_palette_id: normalized_palette_id,
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
