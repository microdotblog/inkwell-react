import { StyleSheet } from 'react-native';

export const DEFAULT_TEXT_SCALE = 1;
export const MIN_TEXT_SCALE = 0.75;
export const MAX_TEXT_SCALE = 1.25;
export const TEXT_SCALE_STEP = 0.05;
export const TEXT_SCALE_PRESETS = buildTextScalePresets();
export const TEXT_SCALE_PRESET_COUNT = TEXT_SCALE_PRESETS.length;
export const TEXT_SCALE_DEFAULT_INDEX = TEXT_SCALE_PRESETS.indexOf(
  DEFAULT_TEXT_SCALE,
);

export function normalizeTextScale(raw_text_scale = DEFAULT_TEXT_SCALE) {
  const parsed_text_scale = Number(raw_text_scale);

  if (!Number.isFinite(parsed_text_scale)) {
    return DEFAULT_TEXT_SCALE;
  }

  const clamped_text_scale = Math.min(
    Math.max(parsed_text_scale, MIN_TEXT_SCALE),
    MAX_TEXT_SCALE,
  );

  return round_to_step(clamped_text_scale, TEXT_SCALE_STEP);
}

export function formatTextScaleLabel(text_scale = DEFAULT_TEXT_SCALE) {
  return `${Math.round(normalizeTextScale(text_scale) * 100)}%`;
}

export function getTextScaleForSliderIndex(
  raw_index = TEXT_SCALE_DEFAULT_INDEX,
) {
  const parsed_index = Number(raw_index);

  if (!Number.isFinite(parsed_index)) {
    return DEFAULT_TEXT_SCALE;
  }

  const clamped_index = Math.min(
    Math.max(Math.round(parsed_index), 0),
    TEXT_SCALE_PRESET_COUNT - 1,
  );

  return TEXT_SCALE_PRESETS[clamped_index] ?? DEFAULT_TEXT_SCALE;
}

export function getTextScaleSliderIndex(
  raw_text_scale = DEFAULT_TEXT_SCALE,
) {
  const normalized_text_scale = normalizeTextScale(raw_text_scale);
  const matched_index = TEXT_SCALE_PRESETS.indexOf(normalized_text_scale);

  if (matched_index >= 0) {
    return matched_index;
  }

  return TEXT_SCALE_DEFAULT_INDEX >= 0 ? TEXT_SCALE_DEFAULT_INDEX : 0;
}

export function scaleTextMetric(metric, text_scale = DEFAULT_TEXT_SCALE) {
  const parsed_metric = Number(metric);

  if (!Number.isFinite(parsed_metric)) {
    return undefined;
  }

  return round_metric(parsed_metric * normalizeTextScale(text_scale));
}

export function getScaledTextStyle(style, text_scale = DEFAULT_TEXT_SCALE) {
  const flattened_style = StyleSheet.flatten(style) || {};
  const scaled_style = {};
  const scaled_font_size = scaleTextMetric(
    flattened_style.fontSize,
    text_scale,
  );
  const scaled_line_height = scaleTextMetric(
    flattened_style.lineHeight,
    text_scale,
  );

  if (scaled_font_size !== undefined) {
    scaled_style.fontSize = scaled_font_size;
  }

  if (scaled_line_height !== undefined) {
    scaled_style.lineHeight = scaled_line_height;
  }

  return scaled_style;
}

export function createScaledTextStyles(
  style_sheet = {},
  style_names = [],
  text_scale = DEFAULT_TEXT_SCALE,
) {
  return style_names.reduce((scaled_styles, style_name) => {
    return {
      ...scaled_styles,
      [style_name]: getScaledTextStyle(style_sheet[style_name], text_scale),
    };
  }, {});
}

function round_metric(metric = 0) {
  return Math.round(metric * 100) / 100;
}

function round_to_step(value = DEFAULT_TEXT_SCALE, step = TEXT_SCALE_STEP) {
  const safe_step = Number(step);

  if (!Number.isFinite(safe_step) || safe_step <= 0) {
    return round_metric(value);
  }

  return round_metric(Math.round(value / safe_step) * safe_step);
}

function buildTextScalePresets() {
  const preset_count =
    Math.round((MAX_TEXT_SCALE - MIN_TEXT_SCALE) / TEXT_SCALE_STEP) + 1;

  return Array.from({ length: preset_count }, (_, index) => {
    return round_to_step(MIN_TEXT_SCALE + index * TEXT_SCALE_STEP);
  });
}
