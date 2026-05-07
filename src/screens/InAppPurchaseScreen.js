import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from 'mobx-react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIAP } from 'expo-iap';

import AuthBackground from '../components/auth/AuthBackground';
import AuthCard from '../components/auth/AuthCard';
import PrimaryButton from '../components/auth/PrimaryButton';
import AppStore from '../stores/App';
import Auth from '../stores/Auth';
import { getAuthTheme } from '../theme/authTheme';
import { createScaledTextStyles } from '../theme/textScale';

const INKWELL_MONTHLY_PRODUCT_ID = 'blog.micro.inkwell.monthly';
const TEXT_STYLE_NAMES = [
  'title',
  'body',
  'price',
  'renewalText',
  'statusText',
];

function InAppPurchaseScreen({ isDark = false }) {
  const accent_palette_id = AppStore.accent_palette_id;
  const theme = getAuthTheme(isDark, accent_palette_id);
  const scaled_text_styles = React.useMemo(() => {
    return createScaledTextStyles(styles, TEXT_STYLE_NAMES);
  }, []);

  if (Platform.OS !== 'ios') {
    return (
      <SubscriptionShell theme={theme}>
        <AuthCard style={styles.card} theme={theme}>
          <View style={styles.headerStack}>
            <Text
              style={[
                styles.title,
                scaled_text_styles.title,
                { color: theme.colors.ink },
              ]}
            >
              Inkwell requires a Micro.blog subscription.
            </Text>
            <Text
              style={[
                styles.body,
                scaled_text_styles.body,
                { color: theme.colors.inkSoft },
              ]}
            >
              Please update your Micro.blog account to continue using Inkwell.
            </Text>
          </View>
        </AuthCard>

        <SignOutButton disabled={Auth.is_loading()} theme={theme} />
      </SubscriptionShell>
    );
  }

  return (
    <IOSSubscriptionContent
      scaled_text_styles={scaled_text_styles}
      theme={theme}
    />
  );
}

function IOSSubscriptionContent({
  scaled_text_styles,
  theme,
}) {
  const [is_purchase_finishing, set_is_purchase_finishing] = React.useState(false);
  const [status_message, set_status_message] = React.useState(null);
  const has_requested_products_ref = React.useRef(false);
  const {
    connected,
    subscriptions,
    fetchProducts,
    finishTransaction,
    requestPurchase,
  } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      set_is_purchase_finishing(true);
      set_status_message('Finishing subscription...');

      try {
        await finishTransaction({
          purchase,
          isConsumable: false,
        });
        await Auth.refresh_verified_session();

        if (Auth.has_inkwell) {
          set_status_message(null);
        } else {
          set_status_message('Subscription is processing. Please try again in a moment.');
        }
      } catch (error) {
        console.warn('Failed to finish Inkwell subscription', error);
        set_status_message('We could not finish the subscription. Please try again.');
      } finally {
        set_is_purchase_finishing(false);
      }
    },
    onPurchaseError: (error) => {
      if (is_user_cancelled_purchase(error)) {
        set_status_message(null);
      } else {
        console.warn('Inkwell subscription failed', error);
        set_status_message('We could not complete the subscription. Please try again.');
      }
    },
    onError: (error) => {
      console.warn('Inkwell subscription store error', error);
      set_status_message('We could not load subscriptions. Please try again.');
    },
  });
  const subscription_product = subscriptions.find((product) => {
    return product.id === INKWELL_MONTHLY_PRODUCT_ID;
  });
  const is_store_loading =
    connected &&
    !subscription_product &&
    has_requested_products_ref.current;
  const is_subscribing = is_purchase_finishing || Auth.is_loading();
  const is_subscribe_disabled =
    is_subscribing ||
    !connected ||
    !subscription_product;

  React.useEffect(() => {
    if (!connected || has_requested_products_ref.current) {
      return;
    }

    has_requested_products_ref.current = true;
    fetchProducts({
      skus: [INKWELL_MONTHLY_PRODUCT_ID],
      type: 'subs',
    });
  }, [connected, fetchProducts]);

  async function handle_subscribe() {
    if (!connected || !subscription_product) {
      set_status_message('Subscriptions are still loading. Please try again.');
      return;
    }

    set_status_message(null);
    try {
      await requestPurchase({
        request: {
          apple: {
            sku: INKWELL_MONTHLY_PRODUCT_ID,
          },
          google: {
            skus: [INKWELL_MONTHLY_PRODUCT_ID],
          },
        },
        type: 'subs',
      });
    } catch (error) {
      if (is_user_cancelled_purchase(error)) {
        set_status_message(null);
      } else {
        console.warn('Failed to start Inkwell subscription', error);
        set_status_message('We could not start the subscription. Please try again.');
      }
    }
  }

  return (
    <SubscriptionShell theme={theme}>
      <AuthCard style={styles.card} theme={theme}>
        <View style={styles.headerStack}>
          <Text
            style={[
              styles.title,
              scaled_text_styles.title,
              { color: theme.colors.ink },
            ]}
          >
            Subscribe to Micro.blog
          </Text>
          <Text
            style={[
              styles.renewalText,
              scaled_text_styles.renewalText,
              { color: theme.colors.inkSoft },
            ]}
          >
            Inkwell requires a Micro.blog subscription. Micro.blog includes everything you need for blog hosting.
          </Text>
        </View>

        <View style={styles.includesStack}>
          <IncludedFeature label="Blog hosting with Micro.blog" theme={theme} />
          <IncludedFeature label="Use your own domain name" theme={theme} />
          <IncludedFeature label="Cross-posting to other services" theme={theme} />
          <IncludedFeature label="Private and shared notes" theme={theme} />
          <IncludedFeature label="Feeds sync in Inkwell" theme={theme} />
        </View>

        <View style={styles.priceStack}>
          <Text
            style={[
              styles.price,
              scaled_text_styles.price,
              { color: theme.colors.ink },
            ]}
          >
            $5/month
          </Text>
          <Text
            style={[
              styles.renewalText,
              scaled_text_styles.renewalText,
              { color: theme.colors.inkSoft },
            ]}
          >
            Automatically renews each month until cancelled.
          </Text>
        </View>

        {status_message ? (
          <Text
            style={[
              styles.statusText,
              scaled_text_styles.statusText,
              { color: theme.colors.accentStrong },
            ]}
          >
            {status_message}
          </Text>
        ) : null}

        <View style={styles.actionStack}>
          <PrimaryButton
            disabled={is_subscribe_disabled}
            label={is_subscribing ? 'Subscribing...' : 'Subscribe'}
            onPress={handle_subscribe}
            style={styles.subscribeButton}
            theme={theme}
          />

          {is_store_loading ? (
            <ActivityIndicator color={theme.colors.accent} size="small" />
          ) : null}
        </View>
      </AuthCard>

      <SignOutButton disabled={is_subscribing} theme={theme} />
    </SubscriptionShell>
  );
}

function SubscriptionShell({
  children,
  theme,
}) {
  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <AuthBackground theme={theme} />

      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SignOutButton({
  disabled = false,
  theme,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={Auth.sign_out}
      style={({ pressed }) => [
        styles.signOutButton,
        pressed && !disabled ? styles.signOutButtonPressed : null,
      ]}
    >
      <Text
        style={[
          styles.signOutText,
          { color: theme.colors.inkSoft },
        ]}
      >
        Sign Out
      </Text>
    </Pressable>
  );
}

function IncludedFeature({
  label = '',
  theme,
}) {
  return (
    <View style={styles.includedRow}>
      <MaterialIcons color={theme.colors.accentStrong} name="check" size={20} />
      <Text style={[styles.body, { color: theme.colors.ink }]}>
        {label}
      </Text>
    </View>
  );
}

function is_user_cancelled_purchase(error = null) {
  const code = `${error?.code || ''}`.toLowerCase();
  const message = `${error?.message || ''}`.toLowerCase();

  return (
    code.includes('cancel') ||
    code.includes('user-cancel') ||
    message.includes('cancel')
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  card: {
    gap: 28,
    padding: 24,
  },
  headerStack: {
    gap: 15,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 26,
  },
  includesStack: {
    gap: 14,
  },
  includedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  body: {
    flex: 1,
    fontSize: 17,
    lineHeight: 24,
  },
  priceStack: {
    gap: 8,
  },
  price: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 24,
  },
  renewalText: {
    fontSize: 15,
    lineHeight: 22,
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionStack: {
    alignItems: 'center',
    gap: 14,
  },
  subscribeButton: {
    width: '100%',
  },
  signOutButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    paddingVertical: 6,
  },
  signOutButtonPressed: {
    opacity: 0.62,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
});

export default observer(InAppPurchaseScreen);
