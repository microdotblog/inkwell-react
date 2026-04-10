const READ_ROW_OPACITY = 0.56;

export function resolve_feed_timeline_entry_content(entry = null) {
  const source_label = resolve_source_label(entry?.source, 'Feed');
  const title = resolve_feed_entry_title(entry);
  const display_title = title || source_label;

  return {
    display_title,
    row_opacity: entry?.is_read ? READ_ROW_OPACITY : 1,
    secondary_source_label: title ? source_label : '',
    show_bookmark_indicator: Boolean(entry?.is_bookmarked),
    source_label,
    summary: resolve_feed_entry_summary(entry, title),
    timestamp: format_timeline_entry_timestamp(entry?.published_at),
  };
}

export function resolve_bookmark_timeline_entry_content(entry = null) {
  const source_label = resolve_source_label(entry?.source, 'Bookmarked');
  const title = resolve_bookmark_entry_title(entry);
  const display_title = title || source_label;

  return {
    display_title,
    row_opacity: 1,
    secondary_source_label: title ? source_label : '',
    show_bookmark_indicator: false,
    source_label,
    summary: resolve_bookmark_entry_summary(entry, title),
    timestamp: format_timeline_entry_timestamp(entry?.published_at),
  };
}

export function format_timeline_entry_timestamp(raw_date = '') {
  if (!raw_date) {
    return '';
  }

  const date = new Date(raw_date);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const date_part = date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
  });
  const time_part = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (!date_part) {
    return time_part;
  } else if (!time_part) {
    return date_part;
  } else {
    return `${date_part}, ${time_part}`;
  }
}

function resolve_feed_entry_title(entry = null) {
  return normalize_entry_text(entry?.title);
}

function resolve_feed_entry_summary(entry = null, title = '') {
  const normalized_title = normalize_entry_text(title || entry?.title);
  const summary = normalize_entry_text(entry?.summary);

  if (!summary) {
    return '';
  } else if (normalized_title && summary === normalized_title) {
    return '';
  } else {
    return summary;
  }
}

function resolve_bookmark_entry_title(entry = null) {
  const title = normalize_entry_text(entry?.title);

  if (title.toLowerCase() === 'untitled') {
    return '';
  } else {
    return title;
  }
}

function resolve_bookmark_entry_summary(entry = null, title = '') {
  const normalized_title = normalize_entry_text(title || entry?.title);
  const summary =
    normalize_entry_text(entry?.summary) ||
    extract_preview_text(entry?.content);

  if (!summary) {
    return '';
  } else if (normalized_title && summary === normalized_title) {
    return '';
  } else {
    return summary;
  }
}

function resolve_source_label(source = '', fallback_label = 'Feed') {
  const normalized_source = normalize_entry_text(source);

  if (normalized_source) {
    return normalized_source;
  } else {
    return fallback_label;
  }
}

function normalize_entry_text(value = '') {
  return `${value || ''}`.replace(/\s+/g, ' ').trim();
}

function extract_preview_text(content = '') {
  const html = `${content || ''}`.trim();

  if (!html) {
    return '';
  }

  const text = decode_html_entities(
    html
      .replace(/<\s*br\s*\/?>/gi, ' ')
      .replace(/<\s*\/\s*p\s*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

  if (text.length <= 280) {
    return text;
  } else {
    return `${text.slice(0, 277).trimEnd()}...`;
  }
}

function decode_html_entities(value = '') {
  return `${value || ''}`.replace(
    /&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi,
    (match, entity) => {
      const normalized_entity = `${entity || ''}`.toLowerCase();

      if (normalized_entity === 'amp') {
        return '&';
      } else if (normalized_entity === 'apos') {
        return "'";
      } else if (normalized_entity === 'gt') {
        return '>';
      } else if (normalized_entity === 'lt') {
        return '<';
      } else if (normalized_entity === 'nbsp') {
        return ' ';
      } else if (normalized_entity === 'quot') {
        return '"';
      } else if (normalized_entity.startsWith('#x')) {
        const code_point = Number.parseInt(normalized_entity.slice(2), 16);

        if (Number.isInteger(code_point)) {
          return String.fromCodePoint(code_point);
        }
      } else if (normalized_entity.startsWith('#')) {
        const code_point = Number.parseInt(normalized_entity.slice(1), 10);

        if (Number.isInteger(code_point)) {
          return String.fromCodePoint(code_point);
        }
      }

      return match;
    },
  );
}
