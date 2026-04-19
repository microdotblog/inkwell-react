import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MenuView } from '@react-native-menu/menu';

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
];

export default function HighlightItem({
  entry = null,
  is_copied = false,
  is_deleting = false,
  onCopyLinkPress,
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
  const post_url = normalize_string(entry?.post_url);
  const menu_actions = React.useMemo(() => {
    return get_highlight_row_actions({
      can_copy_link: Boolean(post_url),
      can_post: typeof onPostPress === 'function',
      is_copied,
      theme,
    });
  }, [is_copied, onPostPress, post_url, theme]);
  const handle_menu_action = React.useCallback((action_id = '') => {
    if (action_id === 'post') {
      onPostPress?.(entry);
      return;
    }

    if (action_id === 'copy_link') {
      onCopyLinkPress?.(entry);
      return;
    }

    if (action_id === 'copy_text') {
      onCopyPress?.(entry);
      return;
    }

    if (action_id === 'delete') {
      onDeletePress?.(entry);
    }
  }, [entry, onCopyLinkPress, onCopyPress, onDeletePress, onPostPress]);

  const row_content = (
    <View
      style={[
        styles.rowCard,
        {
          backgroundColor: theme.colors.paper,
          borderColor: theme.colors.line,
          opacity: is_deleting ? 0.64 : 1,
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
      </View>
    </View>
  );

  return (
    <MenuView
      accessibilityLabel={`Options for highlight from ${post_label}`}
      actions={menu_actions}
      onPressAction={({ nativeEvent }) => {
        handle_menu_action(nativeEvent.event);
      }}
      shouldOpenOnLongPress={!is_deleting}
      themeVariant={theme?.isDark ? 'dark' : 'light'}
    >
      {row_content}
    </MenuView>
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
    gap: 2,
    paddingHorizontal: 18,
    paddingTop: 11,
    paddingBottom: 15,
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

function normalize_string(value = '') {
  return `${value || ''}`.trim();
}

function get_highlight_row_actions({
  can_copy_link = false,
  can_post = false,
  is_copied = false,
  theme,
}) {
  const actions = [];
  const icon_color = theme?.colors?.ink;

  if (can_post) {
    actions.push({
      id: 'post',
      image: Platform.select({
        ios: 'square.and.pencil',
      }),
      imageColor: icon_color,
      title: 'New Post...',
    });
  }

  if (can_copy_link) {
    actions.push({
      id: 'copy_link',
      image: Platform.select({
        ios: 'link',
      }),
      imageColor: icon_color,
      title: 'Copy Link',
    });
  }

  actions.push({
    id: 'copy_text',
    image: Platform.select({
      ios: 'doc.on.doc',
    }),
    imageColor: icon_color,
    title: is_copied ? 'Copied Text' : 'Copy Text',
  });

  actions.push({
    attributes: {
      destructive: true,
    },
    id: 'delete',
    image: Platform.select({
      ios: 'trash',
    }),
    imageColor: theme?.colors?.danger,
    title: 'Delete',
  });

  return actions;
}
