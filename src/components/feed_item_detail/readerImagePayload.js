function decode_html_entities(value = "") {
  return `${value || ""}`.replace(
    /&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi,
    (match, entity) => {
      const normalized_entity = `${entity || ""}`.toLowerCase();

      if (normalized_entity === "amp") {
        return "&";
      } else if (normalized_entity === "apos") {
        return "'";
      } else if (normalized_entity === "gt") {
        return ">";
      } else if (normalized_entity === "lt") {
        return "<";
      } else if (normalized_entity === "nbsp") {
        return " ";
      } else if (normalized_entity === "quot") {
        return '"';
      } else if (normalized_entity.startsWith("#x")) {
        const code_point = Number.parseInt(normalized_entity.slice(2), 16);

        if (Number.isInteger(code_point)) {
          return String.fromCodePoint(code_point);
        }
      } else if (normalized_entity.startsWith("#")) {
        const code_point = Number.parseInt(normalized_entity.slice(1), 10);

        if (Number.isInteger(code_point)) {
          return String.fromCodePoint(code_point);
        }
      }

      return match;
    },
  );
}

function normalize_http_url(raw_url = "", options = {}) {
  const trimmed_url = decode_html_entities(`${raw_url || ""}`).trim();
  const base_url =
    typeof options === "string" ? options : options?.base_url || "";

  if (!trimmed_url) {
    return "";
  }

  try {
    const parsed_url = base_url
      ? new URL(trimmed_url, base_url)
      : new URL(trimmed_url);

    if (parsed_url.protocol === "http:" || parsed_url.protocol === "https:") {
      return parsed_url.toString();
    }
  } catch {
    return "";
  }

  return "";
}

function rewrite_micro_blog_photo_proxy_url(raw_url = "") {
  const normalized_url = normalize_http_url(raw_url);

  if (!normalized_url) {
    return "";
  }

  try {
    const parsed_url = new URL(normalized_url);
    const is_micro_blog_photo_host =
      parsed_url.hostname === "micro.blog" ||
      parsed_url.hostname === "cdn.micro.blog";

    if (!is_micro_blog_photo_host) {
      return normalized_url;
    }

    const path_parts = parsed_url.pathname.split("/");

    if (
      path_parts.length < 4 ||
      path_parts[1] !== "photos" ||
      !/^\d+$/.test(path_parts[2])
    ) {
      return normalized_url;
    }

    path_parts[2] = "1000";
    parsed_url.pathname = path_parts.join("/");
    return parsed_url.toString();
  } catch {
    return normalized_url;
  }
}

function resolve_reader_image_viewer_payload(payload = {}) {
  const image_url = rewrite_micro_blog_photo_proxy_url(
    payload?.image_url || payload?.image_src || payload?.src,
  );

  if (!image_url) {
    return null;
  }

  return {
    image_alt: `${payload?.image_alt || payload?.alt || ""}`.trim(),
    image_url,
  };
}

export {
  normalize_http_url,
  resolve_reader_image_viewer_payload,
  rewrite_micro_blog_photo_proxy_url,
};
