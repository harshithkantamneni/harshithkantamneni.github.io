import rss from '@astrojs/rss';

// Derive items from the same source of truth the catalog pages use:
// each report / note .astro page exports `meta` from its frontmatter.
// `import.meta.glob` with `eager: true` resolves at build time so we
// don't have to await anything inside the GET handler.
const reportModules = import.meta.glob('./reports/*.astro', { eager: true });
const noteModules   = import.meta.glob('./notes/*.astro',   { eager: true });

function collect(modules, type) {
  const out = [];
  for (const [path, mod] of Object.entries(modules)) {
    if (!mod.meta || mod.meta.type !== type) continue;
    const slug = path.split('/').pop().replace(/\.astro$/, '');
    if (slug === 'index') continue;
    out.push({
      title: mod.meta.title,
      pubDate: new Date(mod.meta.date),
      description: mod.meta.description || '',
      link: (type === 'report' ? '/reports/' : '/notes/') + slug,
    });
  }
  return out;
}

const items = [...collect(reportModules, 'report'), ...collect(noteModules, 'note')]
  .sort((a, b) => b.pubDate - a.pubDate);

export async function GET(context) {
  return rss({
    title: 'Harshith Kantamneni',
    description: 'I design and run autonomous AI labs. Reports, notes, and operating decisions.',
    site: context.site,
    stylesheet: '/rss.xsl',
    items,
    customData: '<language>en-us</language>',
  });
}
