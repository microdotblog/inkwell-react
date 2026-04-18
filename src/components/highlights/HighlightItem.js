import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { resolve_highlight_post_label } from '../../stores/Highlights';
import {
  createScaledTextStyles,
} from '../../theme/textScale';

const HIGHLIGHT_LIGHT_BACKGROUND = '#FFF9D6';
const HIGHLIGHT_DARK_BACKGROUND = '#D98C3A';
const TEXT_STYLE_NAMES = [
  'highlightText',
  'postLabel',
  'timestamp',
  'actionButtonLabel',
];

export default function HighlightItem({
  entry = null,
  is_copied = false,
  is_deleting = false,
  onCopyPress,
  onDeletePress,
  onPostPress,
  theme,
}) {
  const scaled_text_styles = React.useMemo(() => {
    return createScaledTextStyles(styles, TEXT_STYLE_NAMES);
  }, []);
  const post_label = resolve_highlight_post_label(entry);
  const timestamp = format_highlight_date(entry);
  const highlight_background_color = resolve_highlight_background_color(theme);
  const delete_button_colors = resolve_highlight_delete_button_colors(theme);

  return (
    <View
      style={[
        styles.rowCard,
        {
          backgroundColor: theme.colors.paper,
          borderColor: theme.colors.line,
        },
      ]}
    >
      <View
        style={[
          styles.highlightWrap,
          {
            backgroundColor: highlight_background_color,
          },
        ]}
      >
        <Text
          style={[
            styles.highlightText,
            scaled_text_styles.highlightText,
            {
              color: theme.colors.ink,
            },
          ]}
        >
          {entry?.text}
        </Text>
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowMeta}>
          <Text
            style={[
              styles.postLabel,
              scaled_text_styles.postLabel,
              { color: theme.colors.ink },
            ]}
          >
            {post_label}
          </Text>
          {timestamp ? (
            <Text
              style={[
                styles.timestamp,
                scaled_text_styles.timestamp,
                { color: theme.colors.inkSoft },
              ]}
            >
              {timestamp}
            </Text>
          ) : null}
        </View>

        <View style={styles.rowActions}>
          <Pressable
            accessibilityLabel="New post from highlight"
            accessibilityRole="button"
            disabled={is_deleting || !onPostPress}
            onPress={() => onPostPress?.(entry)}
            style={({ pressed }) => {
              return [
                styles.actionButton,
                {
                  backgroundColor: theme.colors.buttonGhost,
                  borderColor: theme.colors.line,
                  opacity: is_deleting || !onPostPress ? 0.5 : pressed ? 0.84 : 1,
                },
              ];
            }}
          >
            <Text
              style={[
                styles.actionButtonLabel,
                scaled_text_styles.actionButtonLabel,
                { color: theme.colors.inkSoft },
              ]}
            >
              New Post...
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel={is_copied ? 'Copied highlight text' : 'Copy highlight text'}
            accessibilityRole="button"
            disabled={is_deleting}
            onPress={() => onCopyPress?.(entry)}
            style={({ pressed }) => {
              return [
                styles.actionButton,
                {
                  backgroundColor: is_copied
                    ? theme.colors.accentSoft
                    : theme.colors.buttonGhost,
                  borderColor: theme.colors.line,
                  opacity: is_deleting ? 0.5 : pressed ? 0.84 : 1,
                },
              ];
            }}
          >
            <Text
              style={[
                styles.actionButtonLabel,
                scaled_text_styles.actionButtonLabel,
                {
                  color: is_copied
                    ? theme.colors.accentStrong
                    : theme.colors.inkSoft,
                },
              ]}
            >
              {is_copied ? 'Copied' : 'Copy'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Delete highlight"
            accessibilityRole="button"
            disabled={is_deleting}
            onPress={() => onDeletePress?.(entry)}
            style={({ pressed }) => {
              return [
                styles.actionButton,
                {
                  backgroundColor: delete_button_colors.backgroundColor,
                  borderColor: delete_button_colors.borderColor,
                  opacity: is_deleting ? 0.5 : pressed ? 0.84 : 1,
                },
              ];
            }}
          >
            <Text
              style={[
                styles.actionButtonLabel,
                scaled_text_styles.actionButtonLabel,
                { color: delete_button_colors.labelColor },
              ]}
            >
              {is_deleting ? 'Deleting' : 'Delete'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rowCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  highlightWrap: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  highlightText: {
    fontSize: 15,
    lineHeight: 24,
  },
  rowBody: {
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  rowMeta: {
    gap: 4,
  },
  postLabel: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  timestamp: {
    fontSize: 12,
    lineHeight: 16,
  },
  rowActions: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 28,
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  actionButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
  },
});

function format_highlight_date(highlight = null) {
  const date = resolve_highlight_date(highlight);

  if (!date) {
    return '';
  }

  const date_text = date.toLocaleDateString([], {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
  const time_text = date
    .toLocaleTimeString([], {
      hour: 'numeric',
      hour12: true,
      minute: '2-digit',
    })
    .toLowerCase();

  return `${date_text} ${time_text}`;
}

function resolve_highlight_date(highlight = null) {
  const created_at = parse_date(highlight?.created_at);

  if (created_at) {
    return created_at;
  }

  const published_at = parse_date(highlight?.post_published_at);

  if (published_at) {
    return published_at;
  }

  const local_id = typeof highlight?.id === 'string' ? highlight.id : '';
  const local_match = local_id.match(/^hl-(\d+)$/);

  if (!local_match) {
    return null;
  }

  const timestamp = Number(local_match[1]);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function parse_date(raw_value = '') {
  if (!raw_value) {
    return null;
  }

  const date = new Date(raw_value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function resolve_highlight_background_color(theme) {
  if (theme?.isDark) {
    return HIGHLIGHT_DARK_BACKGROUND;
  }

  return HIGHLIGHT_LIGHT_BACKGROUND;
}

function resolve_highlight_delete_button_colors(theme) {
  if (theme?.isDark) {
    return {
      backgroundColor: 'rgba(188, 84, 110, 0.12)',
      borderColor: 'rgba(255, 160, 182, 0.22)',
      labelColor: '#f2a6ba',
    };
  }

  return {
    backgroundColor: 'rgba(166, 47, 73, 0.05)',
    borderColor: 'rgba(166, 47, 73, 0.18)',
    labelColor: '#a63b58',
  };
}
