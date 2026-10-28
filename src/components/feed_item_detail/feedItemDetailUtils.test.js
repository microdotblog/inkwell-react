import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { transformSync } from "@babel/core";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("./feedItemDetailUtils.js", import.meta.url), "utf8");
const animation = { duration: () => animation };
const context = {
  exports: {},
  URL,
  require(name) {
    if (name === "react-native") {
      return { Linking: {}, Platform: { OS: "ios" } };
    }
    if (name === "react-native-reanimated") {
      return { FadeInDown: animation, FadeOutUp: animation, LinearTransition: animation };
    }
    if (name.includes("textScale")) {
      return { DEFAULT_TEXT_SCALE: 1, scaleTextMetric: (value) => value };
    }
    return require(name);
  },
};
const { code } = transformSync(source, {
  configFile: false,
  babelrc: false,
  plugins: ["@babel/plugin-transform-modules-commonjs"],
});
vm.runInNewContext(code, context);
const { sanitize_reader_html, resolve_highlight_post_id } = context.exports;
const options = { base_url: "https://example.com/articles/123" };

describe("reader HTML sanitization", () => {
  it("canonicalizes slash-delimited attributes instead of passing them through", () => {
    expect(sanitize_reader_html('<img/src=x onerror="window.PWNED=true">', options))
      .toBe('<img src="https://example.com/articles/x">');
    expect(sanitize_reader_html('<svg/onload="window.PWNED=true"></svg>'))
      .toBe("");
  });

  it("discards executable and foreign-content subtrees", () => {
    [
      '<script>alert(1)</script>',
      '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
      '<object data="https://example.com"></object>',
      '<svg><foreignObject><img src=x onerror=alert(1)></foreignObject></svg>',
      '<math><mtext><img src=x onerror=alert(1)></mtext></math>',
      '<template><img src=x onerror=alert(1)></template>',
      '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
    ].forEach((markup) => {
      const result = sanitize_reader_html(markup, options);
      expect(result).not.toMatch(/<(script|iframe|object|svg|math|template|noscript)\b/i);
      expect(result).not.toMatch(/<[^>]*\bonerror\s*=/i);
    });
  });

  it("rejects dangerous URLs, event handlers, and alternate resource attributes", () => {
    const markup = '<a href="jav&#x61;script:alert(1)" onclick="alert(1)">Link</a>' +
      '<img src="data:image/svg+xml,payload" srcset="https://evil.example/1 2x" onerror=alert(1)>' +
      '<video poster="javascript:alert(1)" src="/movie.mp4" onplay=alert(1)></video>';
    expect(sanitize_reader_html(markup, options)).toBe(
      '<a>Link</a><img><video src="https://example.com/movie.mp4" playsinline webkit-playsinline></video>',
    );
  });

  it("preserves article formatting, entities, relative media, and recap attributes", () => {
    const markup = '<div class="reading-recap" style="color:red" data-topics="a &amp; b">' +
      '<p title="a > b">Text &lt;not-a-tag&gt; &copy; <strong>bold</strong></p>' +
      '<a href="../next?a=1&amp;b=2">Next</a><img src="/image.jpg" alt="A &quot;photo&quot;">' +
      '<video controls><source src="/clip.mp4" type="video/mp4"></video>' +
      '<table><tr><td colspan="2">Cell</td></tr></table></div>';
    const result = sanitize_reader_html(markup, options);
    expect(result).toContain('class="reading-recap" style="color:red" data-topics="a &amp; b"');
    expect(result).toContain('title="a &gt; b"');
    expect(result).toContain('Text &lt;not-a-tag&gt; \u00a9 <strong>bold</strong>');
    expect(result).toContain('href="https://example.com/next?a=1&amp;b=2"');
    expect(result).toContain('src="https://example.com/image.jpg" alt="A &quot;photo&quot;"');
    expect(result).toContain('<video controls="" playsinline webkit-playsinline>');
    expect(result).toContain('<td colspan="2">Cell</td>');
    expect(sanitize_reader_html(result, options)).toBe(result);
  });

  it("escapes malformed text and repairs unclosed safe elements", () => {
    expect(sanitize_reader_html('<p>One <strong>two & three')).toBe(
      '<p>One <strong>two &amp; three</strong></p>',
    );
    expect(sanitize_reader_html('Text < broken >')).toBe('Text &lt; broken &gt;');
    expect(() => sanitize_reader_html('<a href="&amp;#999999999999;">Safe</a>', options)).not.toThrow();
  });
});

describe("reader highlight identifiers", () => {
  it("never interprets a bookmark Favorite ID as a feed Entry ID", () => {
    expect(resolve_highlight_post_id("123", "bookmark")).toBe("");
    expect(resolve_highlight_post_id("123", "feed")).toBe("123");
    expect(resolve_highlight_post_id("123", "subscription_feed")).toBe("123");
    expect(resolve_highlight_post_id("", "feed")).toBe("");
  });
});
