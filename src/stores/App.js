import { AppState, Appearance } from 'react-native';
import { flow, types } from 'mobx-state-tree';

import Auth from './Auth';

const AppStore = types
  .model('App', {
    theme: types.optional(types.string, 'light'),
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

    hydrate: flow(function* () {
      self.is_hydrating = true;

      try {
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
