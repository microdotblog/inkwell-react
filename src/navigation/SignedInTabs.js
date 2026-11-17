import React from 'react';
import {
  BackHandler,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { HeaderButton } from '@react-navigation/elements';
import { useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { observer } from 'mobx-react';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-screens/experimental';

import AccountScreen from '../screens/AccountScreen';
import BookmarksScreen from '../screens/BookmarksScreen';
import FeedItemDetailScreen from '../screens/FeedItemDetailScreen';
import FeedScreen from '../screens/FeedScreen';
import HighlightsScreen from '../screens/HighlightsScreen';
import ReplyComposerScreen from '../screens/ReplyComposerScreen';
import SubscriptionFeedScreen from '../screens/SubscriptionFeedScreen';
import SubscriptionsScreen from '../screens/SubscriptionsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import AppStore from '../stores/App';
import { getAuthTheme } from '../theme/authTheme';

const Stack = createNativeStackNavigator();
const LibraryStack = createNativeStackNavigator();
const ANDROID_TABLET_MIN_WIDTH = 600;

function use_workspace_width() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const available_width = Math.max(width - insets.left - insets.right, 0);

  if (Platform.OS === 'android') {
    // A landscape phone can have a wide window without a tablet-sized display.
    const screen = Dimensions.get('screen');
    const is_split =
      Math.min(screen.width, screen.height) >= ANDROID_TABLET_MIN_WIDTH &&
      available_width >= ANDROID_TABLET_MIN_WIDTH;
    return { available_width, is_split };
  }

  // An unfolded Duo can have a large inset for its system controls.
  const is_split =
    Platform.OS === 'ios' &&
    (Platform.isPad
      ? available_width >= 700
      : width >= 600 && height >= 560 && available_width >= 580);

  return { available_width, is_split };
}

function FeedWorkspace({ navigation, route, isDark, theme }) {
  const { available_width, is_split } = use_workspace_width();
  const sidebar_width = Math.round(
    Math.min(360, Math.max(284, available_width * 0.32)),
  );
  const { entry_id = '', mode } = route.params || {};
  const has_reader = Boolean(entry_id) || mode === 'recap';
  const shows_reader_pane = is_split || has_reader;
  const shows_timeline = is_split || !has_reader;
  const reader_background_color = isDark
    ? mode === 'recap' ? '#000000' : theme.colors.canvas
    : theme.colors.white;

  const open_reader = React.useCallback((params) => {
    navigation.setParams({ entry_id: '', mode: 'entry', reply_posted_at: 0, ...params });
  }, [navigation]);

  const close_reader = React.useCallback(() => {
    open_reader({});
  }, [open_reader]);

  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS !== 'android' || is_split || !has_reader) {
        return;
      }

      // An embedded reader can still be visible after the tablet window narrows.
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        close_reader();
        return true;
      });
      return () => subscription.remove();
    }, [close_reader, has_reader, is_split]),
  );

  const open_library = React.useCallback((section, params) => {
    navigation.navigate('Library', { section, section_params: params });
  }, [navigation]);

  return (
    <SafeAreaView edges={{ left: true, right: !is_split }} style={styles.workspace}>
      <View
        accessibilityElementsHidden={!shows_timeline}
        importantForAccessibility={shows_timeline ? 'auto' : 'no-hide-descendants'}
        style={[
          styles.timelinePane,
          is_split && styles.sidebarPane,
          is_split && { width: sidebar_width, borderColor: theme.colors.line },
          !shows_timeline && styles.hiddenPane,
        ]}
      >
        <FeedScreen
          navigation={navigation}
          route={route}
          isDark={isDark}
          is_sidebar={is_split}
          onOpenLibrary={is_split ? open_library : undefined}
          onOpenReader={is_split ? open_reader : undefined}
          selected_entry_id={is_split ? entry_id : ''}
        />
      </View>
      {shows_reader_pane ? (
        <View style={[styles.readerPane, { backgroundColor: reader_background_color }]}>
          <SafeAreaView edges={{ right: is_split }}>
            {has_reader ? (
              <FeedItemDetailScreen
                key={mode === 'recap' ? 'recap' : 'entry'}
                navigation={navigation}
                route={route}
                isDark={isDark}
                is_embedded
                onCloseReader={is_split ? undefined : close_reader}
                pane_width={available_width - (is_split ? sidebar_width : 0)}
              />
            ) : (
              <View style={styles.emptyReader}>
                <MaterialIcons name="article" color={theme.colors.inkSoft} size={32} />
                <Text style={[styles.emptyReaderLabel, { color: theme.colors.inkSoft }]}>No post selected</Text>
              </View>
            )}
          </SafeAreaView>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function TimelineStackReader({ navigation, route, isDark }) {
  const { is_split } = use_workspace_width();

  useFocusEffect(
    React.useCallback(() => {
      if (!is_split) {
        return;
      }

      const { index, routes } = navigation.getState();
      if (routes[index - 1]?.name === 'Feed') {
        navigation.navigate('Feed', route.params, { pop: true });
      }
    }, [is_split, navigation, route.params]),
  );

  return <FeedItemDetailScreen navigation={navigation} route={route} isDark={isDark} />;
}

function ReaderStackScreen({ component: Component, inset = false, ...props }) {
  const screen = <Component {...props} />;

  return inset ? (
    <SafeAreaView edges={{ left: true, right: true }}>{screen}</SafeAreaView>
  ) : screen;
}

function LibrarySheet({ route, navigation, isDark, screen_options, screens, theme }) {
  const { section, section_params } = route.params;
  const supports_reader = section === 'Subscriptions' || section === 'Bookmarks';
  const visible_screens = screens.filter(({ name }) => (
    name === section ||
    (section === 'Subscriptions' && name === 'SubscriptionFeed') ||
    (supports_reader && ['FeedItemDetail', 'UserProfile', 'ReplyComposer'].includes(name))
  ));
  const close_sheet = () => navigation.goBack();
  const close_header_options = Platform.OS === 'ios'
    ? {
        unstable_headerLeftItems: () => [{
          accessibilityLabel: 'Close',
          type: 'button',
          label: 'Close',
          icon: { type: 'sfSymbol', name: 'xmark' },
          onPress: close_sheet,
          tintColor: theme.colors.ink,
        }],
      }
    : {
        headerLeft: () => (
          <HeaderButton accessibilityLabel="Close" onPress={close_sheet}>
            <MaterialIcons name="close" size={24} color={theme.colors.ink} />
          </HeaderButton>
        ),
      };

  const stack = (
    <SafeAreaProvider style={styles.timelinePane}>
      <LibraryStack.Navigator
        initialRouteName={section}
        screenOptions={screen_options}
      >
        {visible_screens.map(({ name, component, options, inset }) => (
          <LibraryStack.Screen
            key={name}
            name={name}
            initialParams={name === section ? section_params : undefined}
            options={name === section
              ? {
                  ...options,
                  headerBackVisible: false,
                  ...close_header_options,
                }
              : options}
          >
            {(screen_props) => (
              <ReaderStackScreen
                {...screen_props}
                component={component}
                inset={inset}
                isDark={isDark}
              />
            )}
          </LibraryStack.Screen>
        ))}
      </LibraryStack.Navigator>
    </SafeAreaProvider>
  );

  if (Platform.OS === 'android') {
    return (
      <SafeAreaView
        edges={{ top: true, right: true, bottom: true, left: true }}
        style={styles.libraryOverlay}
      >
        <View style={[styles.libraryPanel, { backgroundColor: theme.colors.canvas }]}>
          {stack}
        </View>
      </SafeAreaView>
    );
  }

  return stack;
}

function SignedInTabs({ isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const header_background_color =
    resolve_translucent_header_background_color(theme, Platform.OS);
  const feed_item_detail_header_options =
    build_feed_item_detail_header_options(theme, Platform.OS);
  const translucent_header_options = {
    headerBackground: () => (
      <View
        pointerEvents="none"
        style={[
          styles.headerBackdrop,
          {
            backgroundColor: header_background_color,
          },
        ]}
      />
    ),
    headerShadowVisible: false,
    headerStyle: {
      backgroundColor: 'transparent',
    },
    headerTintColor: theme.colors.ink,
    headerTitleStyle: {
      color: theme.colors.ink,
      fontSize: 17,
      fontWeight: '600',
    },
    headerTransparent: true,
  };
  const screen_options = {
    contentStyle: { backgroundColor: theme.colors.canvas },
    headerBackButtonDisplayMode: 'minimal',
    headerStyle: { backgroundColor: theme.colors.paper },
    headerTintColor: theme.colors.ink,
  };
  // Android formSheet cannot host our nested native stack.
  const library_sheet_options = Platform.OS === 'android'
    ? {
        animation: 'fade',
        contentStyle: { backgroundColor: 'transparent' },
        headerShown: false,
        presentation: 'transparentModal',
      }
    : { headerShown: false, presentation: 'pageSheet' };
  const screens = [
    {
      name: 'Account',
      component: AccountScreen,
      options: { ...translucent_header_options, title: 'Settings' },
    },
    {
      name: 'Bookmarks',
      component: BookmarksScreen,
      inset: true,
      options: { ...translucent_header_options, title: 'Bookmarks' },
    },
    {
      name: 'Subscriptions',
      component: SubscriptionsScreen,
      inset: true,
      options: { ...translucent_header_options, title: 'Subscriptions' },
    },
    {
      name: 'SubscriptionFeed',
      component: SubscriptionFeedScreen,
      inset: true,
      options: { ...translucent_header_options, title: 'Feed' },
    },
    {
      name: 'Highlights',
      component: HighlightsScreen,
      inset: true,
      options: { ...translucent_header_options, title: 'Highlights' },
    },
    {
      name: 'FeedItemDetail',
      component: FeedItemDetailScreen,
      inset: true,
      options: { ...feed_item_detail_header_options, title: '' },
    },
    {
      name: 'UserProfile',
      component: UserProfileScreen,
      options: { ...feed_item_detail_header_options, title: '' },
    },
    {
      name: 'ReplyComposer',
      component: ReplyComposerScreen,
      options: { headerBackVisible: false, presentation: 'modal', title: 'Reply' },
    },
  ];

  return (
    <Stack.Navigator
      initialRouteName="Feed"
      screenOptions={screen_options}
    >
      <Stack.Screen
        name="Feed"
        options={{
          headerShown: false,
        }}
      >
        {(screen_props) => (
          <FeedWorkspace {...screen_props} isDark={isDark} theme={theme} />
        )}
      </Stack.Screen>
      {screens.map(({ name, component, options, inset }) => (
        <Stack.Screen key={name} name={name} options={options}>
          {(screen_props) => (
            <ReaderStackScreen
              {...screen_props}
              component={name === 'FeedItemDetail' ? TimelineStackReader : component}
              inset={inset}
              isDark={isDark}
            />
          )}
        </Stack.Screen>
      ))}
      {Platform.OS === 'ios' || Platform.OS === 'android' ? (
        <Stack.Screen name="Library" options={library_sheet_options}>
          {(screen_props) => (
            <LibrarySheet
              {...screen_props}
              isDark={isDark}
              screen_options={screen_options}
              screens={screens}
              theme={theme}
            />
          )}
        </Stack.Screen>
      ) : null}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  workspace: {
    flex: 1,
    flexDirection: 'row',
  },
  timelinePane: {
    flex: 1,
  },
  readerPane: {
    flex: 1,
  },
  libraryOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    flex: 1,
    justifyContent: 'center',
  },
  libraryPanel: {
    borderRadius: 24,
    height: '90%',
    maxWidth: 640,
    overflow: 'hidden',
    width: '92%',
  },
  sidebarPane: {
    borderRightWidth: StyleSheet.hairlineWidth,
    flex: 0,
  },
  hiddenPane: {
    display: 'none',
  },
  emptyReader: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  emptyReaderLabel: {
    fontSize: 16,
    textAlign: 'center',
  },
  headerBackdrop: {
    ...StyleSheet.absoluteFill,
  },
});

function resolve_translucent_header_background_color(
  theme,
  platform = Platform.OS,
) {
  if (platform === 'ios') {
    return with_color_opacity(
      theme?.colors?.canvas,
      theme?.isDark ? 0.1 : 0.14,
    );
  }

  return with_color_opacity(
    theme?.colors?.canvas,
    theme?.isDark ? 0.72 : 0.84,
  );
}

function build_feed_item_detail_header_options(
  theme,
  platform = Platform.OS,
) {
  const header_options = {
    headerShadowVisible: false,
  };

  if (platform === 'android') {
    header_options.headerStyle = {
      backgroundColor: theme?.colors?.canvas,
    };
  }

  return header_options;
}

function with_color_opacity(color_value = '', opacity = 1) {
  const normalized_color = `${color_value || ''}`.trim();
  const normalized_opacity = Number.isFinite(opacity)
    ? Math.min(Math.max(opacity, 0), 1)
    : 1;
  const hex_match = normalized_color.match(/^#([0-9a-f]{6})$/i);

  if (!hex_match) {
    return normalized_color || 'rgba(255, 255, 255, 0.84)';
  }

  const hex = hex_match[1];
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${normalized_opacity})`;
}

export default observer(SignedInTabs);
