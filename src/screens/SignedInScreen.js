import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';
import { SafeAreaView } from 'react-native-safe-area-context';

import AuthCard from '../components/auth/AuthCard';
import AuthBackground from '../components/auth/AuthBackground';
import PrimaryButton from '../components/auth/PrimaryButton';
import Auth from '../stores/Auth';
import { getAuthTheme } from '../theme/authTheme';

function SignedInScreen({ isDark = false }) {
  const theme = getAuthTheme(isDark);
  const profile = Auth.current_profile();
  const profile_name = profile.name || 'Micro.blog account';
  const profile_url = profile.url || 'Your token is ready for timeline sync.';
  const avatar_initial = profile_name.charAt(0).toUpperCase() || 'M';
  const is_busy = Auth.is_loading();

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.canvas }]}>
      <AuthBackground theme={theme} />
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Text style={[styles.eyebrow, { color: theme.colors.accentStrong }]}>Session ready</Text>
            <Text style={[styles.title, { color: theme.colors.ink }]}>You're signed in.</Text>
            <Text style={[styles.body, { color: theme.colors.inkSoft }]}>
              Inkwell now has the Micro.blog token it needs for the next reader features.
            </Text>
          </View>

          <AuthCard style={styles.card} theme={theme}>
            <View style={styles.profileRow}>
              {profile.photo ? (
                <Image source={{ uri: profile.photo }} style={styles.avatar} />
              ) : (
                <View
                  style={[
                    styles.avatarFallback,
                    {
                      backgroundColor: theme.colors.accentSoft,
                      borderColor: theme.colors.line,
                    },
                  ]}
                >
                  <Text style={[styles.avatarInitial, { color: theme.colors.accentStrong }]}>
                    {avatar_initial}
                  </Text>
                </View>
              )}

              <View style={styles.profileMeta}>
                <Text style={[styles.profileName, { color: theme.colors.ink }]}>{profile_name}</Text>
                <Text style={[styles.profileUrl, { color: theme.colors.inkSoft }]}>{profile_url}</Text>
              </View>
            </View>

            <View style={styles.metaStack}>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: theme.colors.badge,
                    borderColor: theme.colors.line,
                  },
                ]}
              >
                <Text style={[styles.statusText, { color: theme.colors.inkSoft }]}>
                  {profile.has_inkwell === false
                    ? 'Micro.blog says Inkwell is not enabled for this account yet.'
                    : 'Micro.blog authentication completed successfully.'}
                </Text>
              </View>

              {profile.is_using_ai != null ? (
                <Text style={[styles.helperText, { color: theme.colors.inkSoft }]}>
                  Fading summaries are currently {profile.is_using_ai ? 'enabled' : 'disabled'} for
                  this account.
                </Text>
              ) : null}
            </View>

            <PrimaryButton
              label="Sign out"
              onPress={Auth.sign_out}
              variant="ghost"
              disabled={is_busy}
              theme={theme}
            />
          </AuthCard>
        </ScrollView>
      </SafeAreaView>
    </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 32,
  },
  hero: {
    gap: 14,
    paddingTop: 28,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'Newsreader_700Bold',
    fontSize: 46,
    lineHeight: 52,
    maxWidth: 320,
  },
  body: {
    fontSize: 18,
    lineHeight: 28,
    maxWidth: 336,
  },
  card: {
    gap: 24,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  avatarFallback: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarInitial: {
    fontFamily: 'Newsreader_700Bold',
    fontSize: 28,
    lineHeight: 30,
  },
  profileMeta: {
    flex: 1,
    gap: 6,
  },
  profileName: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 30,
    lineHeight: 36,
  },
  profileUrl: {
    fontSize: 15,
    lineHeight: 22,
  },
  metaStack: {
    gap: 12,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
  },
  helperText: {
    fontSize: 14,
    lineHeight: 21,
  },
});

export default observer(SignedInScreen);
