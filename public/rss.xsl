<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>RSS Feed · <xsl:value-of select="/rss/channel/title"/></title>
        <link rel="stylesheet" href="/_astro/rss-feed.css"/>
        <style>
          @font-face {
            font-family: 'Bricolage Grotesque';
            src: url('/fonts/bricolage-grotesque-variable.woff2') format('woff2-variations');
            font-weight: 200 800;
            font-display: swap;
          }
          @font-face {
            font-family: 'Newsreader';
            src: url('/fonts/newsreader-variable.woff2') format('woff2-variations');
            font-weight: 200 800;
            font-display: swap;
          }
          @font-face {
            font-family: 'JetBrains Mono';
            src: url('/fonts/jetbrains-mono-variable.woff2') format('woff2-variations');
            font-weight: 100 800;
            font-display: swap;
          }
          :root {
            --paper: #E8E5DF;
            --ink: #111111;
            --ink-low: #555555;
            --accent: #FF5722;
            --accent-deep: #C8401B;
            --rule: #111111;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: var(--paper);
            color: var(--ink);
            font-family: 'Newsreader', Georgia, serif;
            font-size: 1.0625rem;
            line-height: 1.6;
            padding: 4rem 1.5rem 6rem;
          }
          .container {
            max-width: 50rem;
            margin: 0 auto;
          }
          .marker {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            color: var(--ink-low);
            margin: 0 0 0.5rem;
            padding-top: 1rem;
            border-top: 1px solid var(--rule);
          }
          h1 {
            font-family: 'Bricolage Grotesque', system-ui, sans-serif;
            font-weight: 700;
            font-size: clamp(2rem, 5vw, 3.5rem);
            line-height: 1.05;
            letter-spacing: -0.02em;
            margin: 0 0 1rem;
          }
          .lede {
            font-family: 'Newsreader', Georgia, serif;
            font-size: clamp(1.125rem, 1.6vw, 1.375rem);
            line-height: 1.45;
            color: var(--ink);
            max-width: 42ch;
            margin: 0 0 2.5rem;
          }
          .section-marker {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            color: var(--ink-low);
            margin: 3rem 0 0.5rem;
            padding-top: 1rem;
            border-top: 1px solid var(--rule);
          }
          h2 {
            font-family: 'Bricolage Grotesque', system-ui, sans-serif;
            font-weight: 700;
            font-size: clamp(1.5rem, 3vw, 2rem);
            line-height: 1.05;
            margin: 0 0 1rem;
          }
          .item {
            padding: 1.5rem 0;
            border-bottom: 1px solid var(--rule);
            display: grid;
            grid-template-columns: 8em 1fr;
            gap: 1rem;
            align-items: baseline;
          }
          .item:first-child { border-top: 1px solid var(--rule); }
          .item-date {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            color: var(--ink-low);
          }
          .item-title {
            font-family: 'Bricolage Grotesque', system-ui, sans-serif;
            font-weight: 600;
            font-size: 1.25rem;
            color: var(--ink);
            text-decoration: none;
            display: block;
            margin-bottom: 0.5rem;
          }
          .item-title:hover { color: var(--accent-deep); }
          .item-desc {
            font-family: 'Newsreader', Georgia, serif;
            font-size: 1rem;
            line-height: 1.55;
            color: var(--ink);
            max-width: 60ch;
            margin: 0;
          }
          @media (max-width: 40em) {
            .item { grid-template-columns: 1fr; gap: 0.25rem; }
          }
          .readers {
            margin: 2rem 0;
          }
          .readers code {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.875rem;
            background: rgba(255, 87, 34, 0.12);
            padding: 0.15em 0.4em;
            color: var(--ink);
            word-break: break-all;
          }
          a { color: var(--accent-deep); }
          a:hover { color: var(--accent); }
          .home-link {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            color: var(--ink);
            text-decoration: none;
            border-bottom: 1px solid var(--ink);
            display: inline-block;
            padding-bottom: 2px;
          }
          .home-link:hover { color: var(--accent-deep); border-bottom-color: var(--accent-deep); }
        </style>
      </head>
      <body>
        <div class="container">
          <p class="marker">RSS FEED</p>
          <h1><xsl:value-of select="/rss/channel/title"/></h1>
          <p class="lede">
            This is the machine-readable feed for <xsl:value-of select="/rss/channel/title"/>.
            Paste the URL of this page into any RSS reader to subscribe and get new
            reports and notes automatically as they ship.
          </p>

          <p class="section-marker">HOW TO USE</p>
          <h2>Subscribe with a reader</h2>
          <div class="readers">
            <p>Pick any reader. The setup is the same: paste this page's URL.</p>
            <p>
              <a href="https://feedly.com/i/subscription/feed/https%3A%2F%2Fharshithkantamneni.github.io%2Frss.xml">Feedly</a>
              <xsl:text>  ·  </xsl:text>
              <a href="https://netnewswire.com/">NetNewsWire</a> (macOS / iOS)
              <xsl:text>  ·  </xsl:text>
              <a href="https://reederapp.com/">Reeder</a>
              <xsl:text>  ·  </xsl:text>
              <a href="https://inoreader.com/">Inoreader</a>
            </p>
            <p>Or paste the feed URL directly:</p>
            <p><code>https://harshithkantamneni.github.io/rss.xml</code></p>
          </div>

          <p class="section-marker">CONTENTS</p>
          <h2>Recent items</h2>
          <div>
            <xsl:for-each select="/rss/channel/item">
              <div class="item">
                <div class="item-date">
                  <xsl:value-of select="substring(pubDate, 6, 11)"/>
                </div>
                <div>
                  <a class="item-title" href="{link}"><xsl:value-of select="title"/></a>
                  <p class="item-desc"><xsl:value-of select="description"/></p>
                </div>
              </div>
            </xsl:for-each>
          </div>

          <p style="margin-top: 4rem;">
            <a class="home-link" href="/">← RETURN HOME</a>
          </p>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
