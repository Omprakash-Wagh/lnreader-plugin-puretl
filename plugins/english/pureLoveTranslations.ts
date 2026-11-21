import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { Filters, FilterTypes } from '@libs/filterInputs';
import { load as parseHTML } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';

class PureLoveTranslationsPlugin implements Plugin.PluginBase {
  id = 'pureLoveTranslations';
  name = 'Pure Love Translations';
  icon = 'src/en/pureLoveTranslations/icon.png';
  site = 'https://puretl.com';
  version = '1.0.2';

  filters = {
    status: {
      label: 'Status',
      value: '',
      type: FilterTypes.Picker,
      options: [
        { label: 'All', value: '' },
        { label: 'Ongoing', value: 'ongoing' },
        { label: 'Completed', value: 'completed' },
      ],
    },
    sort: {
      label: 'Sort',
      value: '',
      type: FilterTypes.Picker,
      options: [
        { label: 'Default', value: '' },
        { label: 'A-Z', value: 'asc' },
        { label: 'Z-A', value: 'desc' },
      ],
    },
  } satisfies Filters;

  async popularNovels(
    pageNo: number,
    options?: Plugin.PopularNovelsOptions<typeof this.filters>,
  ): Promise<Plugin.NovelItem[]> {
    // PureTL hosts its entire catalogue on the /translations page
    if (pageNo > 1) {
      return [];
    }

    const response = await fetchApi(`${this.site}/translations`);
    const body = await response.text();
    const $ = parseHTML(body);
    const novels: Plugin.NovelItem[] = [];
    const seenPaths = new Set<string>();

    // 1. Primary extractor: Squarespace gallery grid items
    $('figure.gallery-grid-item, figure[class*="gallery-"]').each((_, el) => {
      const link = $(el).find('a.gallery-grid-image-link, a[href]');
      const href = link.attr('href');
      if (!href) return;

      const cleanPath = this.cleanRelativePath(href);
      if (!this.isValidNovelPath(cleanPath) || seenPaths.has(cleanPath)) return;

      const img = $(el).find('img');
      const altText = img.attr('alt')?.trim();
      const linkText = link.text().trim();
      const rawName = altText || linkText || this.slugToTitle(cleanPath);

      const coverSrc =
        img.attr('data-src') ||
        img.attr('data-image') ||
        img.attr('src') ||
        defaultCover;

      seenPaths.add(cleanPath);
      novels.push({
        name: rawName,
        path: cleanPath,
        cover: coverSrc,
      });
    });

    // 2. Fallback: Check other links on the translations page if gallery items weren't found
    if (novels.length === 0) {
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        const cleanPath = this.cleanRelativePath(href);
        if (!this.isValidNovelPath(cleanPath) || seenPaths.has(cleanPath))
          return;

        const text = $(el).text().trim();
        if (text && text.length > 2) {
          seenPaths.add(cleanPath);
          novels.push({
            name: text,
            path: cleanPath,
            cover: defaultCover,
          });
        }
      });
    }

    // Apply filters if provided
    let results = novels;
    if (options?.filters?.sort?.value === 'asc') {
      results.sort((a, b) => a.name.localeCompare(b.name));
    } else if (options?.filters?.sort?.value === 'desc') {
      results.sort((a, b) => b.name.localeCompare(a.name));
    }

    return results;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const cleanPath = this.cleanRelativePath(novelPath);
    const url = `${this.site}${cleanPath}`;
    const response = await fetchApi(url);
    const body = await response.text();
    const $ = parseHTML(body);

    // 1. Novel Title
    let title = $('h1').first().text().trim();
    if (!title) {
      const ogTitle = $('meta[property="og:title"]').attr('content');
      if (ogTitle) {
        title = ogTitle
          .replace(/\s*&mdash;.*$/i, '')
          .replace(/\s*—.*$/i, '')
          .replace(/\s*-\s*Pure Love Translations.*$/i, '')
          .trim();
      }
    }
    if (!title) {
      title = this.slugToTitle(cleanPath);
    }

    // 2. Cover Image
    let cover = '';
    $('img').each((_, el) => {
      const src =
        $(el).attr('data-src') ||
        $(el).attr('data-image') ||
        $(el).attr('src');
      if (
        src &&
        src.includes('squarespace-cdn.com') &&
        !src.includes('favicon') &&
        !src.includes('HeaderMobile') &&
        !src.includes('PL-')
      ) {
        if (!cover) cover = src;
      }
    });
    if (!cover) {
      const ogImg = $('meta[property="og:image"]').attr('content');
      if (ogImg && !ogImg.includes('HeaderMobile')) {
        cover = ogImg;
      }
    }
    if (!cover) {
      cover = defaultCover;
    }

    // 3. Metadata from content blocks (Author, Status, Genres)
    let author: string | undefined = undefined;
    let status: string = NovelStatus.Unknown;
    let genres: string | undefined = undefined;
    let summary: string | undefined = undefined;

    // Search text blocks for structured metadata
    $('.sqs-html-content, .entry-content, article').each((_, el) => {
      const text = $(el).text();

      // Author extraction
      if (!author) {
        const authorMatch = text.match(/Author:\s*([^\n\r<]+)/i);
        if (authorMatch) {
          author = authorMatch[1].trim();
        }
      }

      // Status extraction
      if (status === NovelStatus.Unknown) {
        const statusMatch = text.match(/Status:\s*([^\n\r<]+)/i);
        if (statusMatch) {
          const rawStatus = statusMatch[1].toLowerCase();
          if (rawStatus.includes('ongoing')) {
            status = NovelStatus.Ongoing;
          } else if (rawStatus.includes('complete')) {
            status = NovelStatus.Completed;
          } else if (rawStatus.includes('hiatus')) {
            status = NovelStatus.OnHiatus;
          }
        }
      }

      // Tags / Genres extraction
      if (!genres) {
        const tagsMatch = text.match(/(?:Tags|Genres):\s*([^\n\r<]+)/i);
        if (tagsMatch) {
          genres = tagsMatch[1]
            .replace(/Status:.*$/i, '')
            .replace(/Author:.*$/i, '')
            .trim();
        }
      }
    });

    // 4. Synopsis / Summary
    const ogDesc = $('meta[property="og:description"]').attr('content');
    if (ogDesc && ogDesc.trim().length > 20) {
      summary = ogDesc.trim();
    } else {
      // Find summary paragraph in content
      $('.sqs-html-content p, .entry-content p').each((_, p) => {
        const pText = $(p).text().trim();
        if (
          !summary &&
          pText.length > 50 &&
          !pText.startsWith('Author:') &&
          !pText.startsWith('Tags:') &&
          !pText.startsWith('Status:') &&
          !pText.includes('cookie') &&
          !pText.includes('updates may be delayed')
        ) {
          summary = pText;
        }
      });
    }

    // 5. Chapters Extraction
    const chapters = this.extractChapters($, cleanPath);

    return {
      path: cleanPath,
      name: title,
      cover,
      author: author || 'Unknown',
      status,
      genres,
      summary,
      chapters,
    };
  }

  private extractChapters(
    $: ReturnType<typeof parseHTML>,
    novelPath: string,
  ): Plugin.ChapterItem[] {
    const chapters: Plugin.ChapterItem[] = [];
    const seenChapterPaths = new Set<string>();
    const cleanNovelSlug = novelPath.replace(/^\//, '').replace(/\/$/, '');

    // Pattern A: Squarespace Archive Block (grouped by arc / volume)
    // Structure: ul.archive-group-list > li.archive-group > ul.archive-item-list > li.archive-item
    const archiveGroups = $('ul.archive-group-list li.archive-group');
    if (archiveGroups.length > 0) {
      archiveGroups.each((_, group) => {
        const groupTitle = $(group)
          .find('a.archive-group-name-link, .archive-group-name')
          .first()
          .text()
          .trim();

        $(group)
          .find('li.archive-item')
          .each((_, item) => {
            const link = $(item).find('a.archive-item-link, a[href]').first();
            const href = link.attr('href');
            if (!href) return;

            const chapPath = this.cleanRelativePath(href);
            if (seenChapterPaths.has(chapPath)) return;

            let chapName = link.text().trim();
            if (!chapName) {
              chapName = this.extractChapterNameFromPath(chapPath);
            }

            // Include group title if not already in chapter name
            const fullName =
              groupTitle && !chapName.includes(groupTitle)
                ? `${groupTitle} - ${chapName}`
                : chapName;

            const dateStr = $(item)
              .find(
                '.archive-item-date-before, .archive-item-date, .archive-item-date-after',
              )
              .first()
              .text()
              .trim();

            seenChapterPaths.add(chapPath);
            chapters.push({
              name: fullName,
              path: chapPath,
              releaseTime: dateStr || undefined,
              chapterNumber: this.extractChapterNumber(chapPath, chapName),
            });
          });
      });
    }

    // Pattern B: Archive items outside groups
    if (chapters.length === 0) {
      $('li.archive-item').each((_, item) => {
        const link = $(item).find('a.archive-item-link, a[href]').first();
        const href = link.attr('href');
        if (!href) return;

        const chapPath = this.cleanRelativePath(href);
        if (seenChapterPaths.has(chapPath)) return;

        let chapName = link.text().trim();
        if (!chapName) {
          chapName = this.extractChapterNameFromPath(chapPath);
        }

        const dateStr = $(item)
          .find(
            '.archive-item-date-before, .archive-item-date, .archive-item-date-after',
          )
          .first()
          .text()
          .trim();

        seenChapterPaths.add(chapPath);
        chapters.push({
          name: chapName,
          path: chapPath,
          releaseTime: dateStr || undefined,
          chapterNumber: this.extractChapterNumber(chapPath, chapName),
        });
      });
    }

    // Pattern C: Accordion block items (e.g., Epiphanies of Rebirth)
    // Structure: .accordion-item__description with paragraphs containing chapter links
    if (chapters.length === 0) {
      $('.accordion-item').each((_, accordion) => {
        const sectionTitle = $(accordion)
          .find('.accordion-item__title')
          .first()
          .text()
          .trim();

        $(accordion)
          .find(
            '.accordion-item__description p, [data-sqsp-accordion-block-item-description] p',
          )
          .each((_, p) => {
            const pText = $(p).text().trim();
            const pLinks = $(p).find('a[href]');

            pLinks.each((_, a) => {
              const href = $(a).attr('href');
              if (!href) return;

              const chapPath = this.cleanRelativePath(href);
              if (seenChapterPaths.has(chapPath)) return;
              if (!chapPath.includes(`/${cleanNovelSlug}/`)) return;

              const linkText = $(a).text().trim();
              let chapName = linkText;

              // If link is just "(Part 1)", prefix with paragraph context like "Chapter 44"
              if (linkText.startsWith('(') && pText) {
                const prefixMatch = pText.match(
                  /(?:Chapter|Episode)\s*\d+[a-zA-Z0-9\s-]*/i,
                );
                if (prefixMatch) {
                  chapName = `${prefixMatch[0].trim()} ${linkText}`;
                }
              }

              if (sectionTitle && !chapName.includes(sectionTitle)) {
                chapName = `${sectionTitle} - ${chapName}`;
              }

              seenChapterPaths.add(chapPath);
              chapters.push({
                name: chapName,
                path: chapPath,
                chapterNumber: this.extractChapterNumber(chapPath, chapName),
              });
            });
          });
      });
    }

    // Pattern D: General link fallback across content blocks
    if (chapters.length === 0) {
      $('a[href]').each((_, a) => {
        const href = $(a).attr('href');
        if (!href) return;

        const chapPath = this.cleanRelativePath(href);
        if (seenChapterPaths.has(chapPath)) return;

        // Check if link belongs to this novel and looks like a chapter
        if (
          chapPath.includes(`/${cleanNovelSlug}/`) &&
          !chapPath.includes('/category/') &&
          !chapPath.includes('/tag/')
        ) {
          const chapName =
            $(a).text().trim() || this.extractChapterNameFromPath(chapPath);
          seenChapterPaths.add(chapPath);
          chapters.push({
            name: chapName,
            path: chapPath,
            chapterNumber: this.extractChapterNumber(chapPath, chapName),
          });
        }
      });
    }

    // Ensure sequential chapter numbering if parsing failed to extract numbers
    chapters.forEach((chap, idx) => {
      if (chap.chapterNumber === undefined || isNaN(chap.chapterNumber)) {
        chap.chapterNumber = idx + 1;
      }
    });

    return chapters;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const cleanPath = this.cleanRelativePath(chapterPath);
    const url = `${this.site}${cleanPath}`;
    const response = await fetchApi(url);
    const body = await response.text();
    const $ = parseHTML(body);

    // Locate chapter title
    let chapterTitle = $(
      'h1.blog-item-title, h1.entry-title, .title h1, h1',
    )
      .first()
      .text()
      .trim();
    if (!chapterTitle) {
      chapterTitle = this.extractChapterNameFromPath(cleanPath);
    }

    // Target the main article body container
    const articleBody = $(
      '[itemprop="articleBody"], .blog-item-content, .entry-content, article.sections',
    ).first();

    if (!articleBody.length) {
      return `<h1>${chapterTitle}</h1><p>Chapter content could not be loaded.</p>`;
    }

    // Extract individual content blocks (HTML text and in-chapter illustrations) in reading order
    const blocks = articleBody.find(
      '.sqs-block-html, .html-block, .sqs-block-image, .image-block',
    );
    const cleanedHtmlParts: string[] = [];

    if (blocks.length > 0) {
      blocks.each((_, block) => {
        const isImageBlock =
          $(block).hasClass('sqs-block-image') ||
          $(block).hasClass('image-block');

        // Handle legitimate in-chapter illustrations, maps, and diagrams
        if (isImageBlock) {
          const img = $(block).find('img').first();
          const src =
            img.attr('data-src') ||
            img.attr('data-image') ||
            img.attr('src');
          if (!src) return;

          // Filter out author avatars, site header logos, favicons, social icons
          if (
            src.includes('memberAccountAvatars') ||
            src.includes('favicon') ||
            src.includes('HeaderMobile') ||
            src.includes('PL-') ||
            img.hasClass('author-avatar-image') ||
            $(block).hasClass('author-avatar')
          ) {
            return;
          }

          const alt = img.attr('alt') || 'Illustration';
          const caption = $(block).find('figcaption, .image-caption').text().trim();
          let imgHtml = `<p style="text-align: center;"><img src="${src}" alt="${alt}" style="max-width: 100%; height: auto;" /></p>`;
          if (caption) {
            imgHtml += `<p style="text-align: center; font-style: italic;"><small>${caption}</small></p>`;
          }
          cleanedHtmlParts.push(imgHtml);
          return;
        }

        const block$ = parseHTML($(block).html() || '');

        // Remove embedded styles, scripts, noscripts, iframes
        block$('style, script, noscript, iframe').remove();

        const blockText = block$.text().trim().toLowerCase();

        // 1. Skip block if the entire block is just an adblock appeal
        if (
          blockText.length < 500 &&
          (blockText.includes('turning off adblock') ||
            blockText.includes('turn off adblock') ||
            blockText.includes('money generated from ads') ||
            blockText.includes('support our translators by turning off adblock'))
        ) {
          return;
        }

        // 2. Skip block if the entire block is purely navigation
        const alphaOnly = blockText.replace(/[^a-z]/g, '');
        if (
          blockText.length < 150 &&
          (alphaOnly === 'backindexnext' ||
            alphaOnly === 'charactersheetindexnext' ||
            alphaOnly === 'indexnext' ||
            alphaOnly === 'backindex' ||
            alphaOnly === 'index' ||
            alphaOnly === 'next' ||
            alphaOnly === 'previous' ||
            alphaOnly === 'back')
        ) {
          return;
        }

        // 3. Fine-grained removal inside paragraphs/headings (NEVER div, to avoid stripping wrapper containers!)
        block$('p, h3, h4, h5, h6').each((_, el) => {
          const pText = block$(el).text().trim().toLowerCase();

          // Remove in-paragraph adblock appeals
          if (
            pText.length < 300 &&
            (pText.includes('turning off adblock') ||
              pText.includes('turn off adblock') ||
              pText.includes('money generated from ads'))
          ) {
            block$(el).remove();
            return;
          }

          // Remove in-paragraph navigation (only if short text)
          if (pText.length < 100) {
            const pAlpha = pText.replace(/[^a-z]/g, '');
            if (
              pAlpha === 'backindexnext' ||
              pAlpha === 'charactersheetindexnext' ||
              pAlpha === 'indexnext' ||
              pAlpha === 'backindex' ||
              pAlpha === 'index' ||
              pAlpha === 'next' ||
              pAlpha === 'previous' ||
              pAlpha === 'back'
            ) {
              block$(el).remove();
              return;
            }
          }

          // Remove site footer policy links if embedded in paragraph
          if (
            pText.includes('privacy policy') &&
            pText.includes('terms of service') &&
            pText.length < 200
          ) {
            block$(el).remove();
            return;
          }
        });

        const blockContent = block$('.sqs-html-content').first();
        const blockHtml = blockContent.length
          ? blockContent.html()
          : block$.html() || '';
        const cleanText = block$.text().trim();

        if (cleanText.length > 0) {
          cleanedHtmlParts.push(blockHtml || '');
        }
      });
    }

    // Fallback if no specific html blocks were matched
    let finalHtml = '';
    if (cleanedHtmlParts.length > 0) {
      finalHtml = cleanedHtmlParts.join('\n');
    } else {
      // Remove known boilerplate containers from article body directly
      articleBody
        .find(
          [
            '.blog-item-comments',
            '.blog-item-author-profile',
            '.sqs-block-socialaccountlinks-v2',
            '.blog-item-pagination',
            '.header',
            '.footer',
            'script',
            'style',
            'noscript',
            'iframe',
            '.sqs-block-button',
            'nav',
          ].join(', '),
        )
        .remove();
      finalHtml = articleBody.html() || '';
    }

    return `<h1>${chapterTitle}</h1>\n${finalHtml.trim()}`;
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    if (pageNo > 1) {
      return [];
    }

    const allNovels = await this.popularNovels(1);
    const query = searchTerm.toLowerCase().trim();

    return allNovels.filter(novel =>
      novel.name.toLowerCase().includes(query),
    );
  }

  resolveUrl = (path: string): string => {
    return `${this.site}${path.startsWith('/') ? path : '/' + path}`;
  };

  private cleanRelativePath(href: string): string {
    return href
      .replace(this.site, '')
      .replace(/#.*$/, '')
      .replace(/\?.*$/, '')
      .replace(/\/$/, '');
  }

  private isValidNovelPath(path: string): boolean {
    if (!path || path === '/' || path.startsWith('/#')) return false;

    const excludedSubstrings = [
      '/novel-shop',
      '/updates',
      '/disclaimer',
      '/privacy-policy',
      '/tos',
      '/terms',
      '/contact',
      '/cart',
      '/translations',
      '.css',
      '.js',
      '.png',
      '.jpg',
    ];

    return !excludedSubstrings.some(excluded => path.includes(excluded));
  }

  private slugToTitle(slug: string): string {
    const clean = slug.replace(/^\//, '').replace(/\/$/, '');
    return clean
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private extractChapterNameFromPath(path: string): string {
    const parts = path.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1] || 'Chapter';
    return lastPart
      .replace(/^c(\d+)/i, 'Chapter $1')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private extractChapterNumber(
    path: string,
    name: string,
  ): number | undefined {
    // Try from path e.g. /ten-day-ultimatum/c123 -> 123
    const pathMatch = path.match(/\/c(\d+(?:\.\d+)?)/i);
    if (pathMatch) {
      return parseFloat(pathMatch[1]);
    }

    // Try from name e.g. "Chapter 123" or "TDU Chapter 123"
    const nameMatch = name.match(/Chapter\s*(\d+(?:\.\d+)?)/i);
    if (nameMatch) {
      return parseFloat(nameMatch[1]);
    }

    // Try any number in name
    const numMatch = name.match(/\b(\d+(?:\.\d+)?)\b/);
    if (numMatch) {
      return parseFloat(numMatch[1]);
    }

    return undefined;
  }
}

export default new PureLoveTranslationsPlugin();
