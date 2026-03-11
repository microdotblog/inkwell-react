import { AppState, Appearance } from 'react-native';
import { types } from 'mobx-state-tree';

const AppStore = types
  .model('App', {
    theme: types.optional(types.string, 'light'),
  })
  .volatile(() => ({
    app_state_subscription: null,
    appearance_subscription: null,
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
  }))
  .views(self => ({
    is_dark_mode() {
      return self.theme === 'dark';
    },
  }))
  .create();

export default AppStore;
