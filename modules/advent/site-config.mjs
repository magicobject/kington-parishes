// The placeholder guards: refuse a theme or content that is still the neutral template from examples/. Generic and pure;
// the host's own loader (scripts/advent-config.mjs) finds and imports src/advent/theme.mjs and content.mjs, then calls these.
import { theme as exampleTheme } from './examples/theme.mjs';
import { content as exampleContent } from './examples/content.mjs';

const GUIDE = 'see modules/advent/INTEGRATION.md';

/** True when `value` is the same data as `example` (the check that a template has been edited). */
export function sameData(value, example) {
  return JSON.stringify(value) === JSON.stringify(example);
}

/** Throws a plain message when `theme` or `content` is still the template copied from modules/advent/examples/. */
export function assertNotPlaceholder({ theme, content }) {
  for (const [name, value, example] of [['theme', theme, exampleTheme], ['content', content, exampleContent]]) {
    if (sameData(value, example)) {
      throw new Error(`Advent: src/advent/${name}.mjs is still the placeholder copied from modules/advent/examples/. Replace it with your own ${name === 'theme' ? 'settings' : '25 days of content'} before building (${GUIDE}).`);
    }
  }
}

const DAY_TEXT_FIELDS = ['title', 'ref', 'wonder', 'prayer', 'alt', 'credit', 'translation'];

/**
 * Every place where the theme or the content still holds the example's own text, as plain sentences. Derived from examples/, so a
 * change to the template changes the check. A site must have none of these before it goes live (goLive true); an edited day that keeps
 * the template's story, prayer, credit or picture description is caught, not only a file that is unchanged.
 */
export function placeholderProblems({ theme, content }) {
  const problems = [];
  for (const field of ['siteName', 'translationName']) {
    if (theme[field] === exampleTheme[field]) problems.push(`theme "${field}" is still "${exampleTheme[field]}"`);
  }
  const examples = new Map([...exampleContent.days, ...(exampleContent.bonus ? [exampleContent.bonus] : [])].map((day) => [day.day, day]));
  for (const day of [...content.days, ...(content.bonus ? [content.bonus] : [])]) {
    const example = examples.get(day.day);
    if (!example) continue;
    for (const field of DAY_TEXT_FIELDS) {
      if (day[field] === example[field]) problems.push(`day ${day.day} "${field}" is still the example text`);
    }
    day.paragraphs.forEach((paragraph, index) => {
      if (paragraph === example.paragraphs[index]) problems.push(`day ${day.day} paragraph ${index + 1} is still the example text`);
    });
  }
  return problems;
}

/** Throws one plain message listing the first few placeholder leftovers, or returns when there are none. */
export function assertNoPlaceholderText({ theme, content }) {
  const problems = placeholderProblems({ theme, content });
  if (problems.length > 0) {
    const shown = problems.slice(0, 5).join('; ');
    throw new Error(`Advent: cannot go live (goLive is true) while example text is left: ${shown}${problems.length > 5 ? `; and ${problems.length - 5} more` : ''} (${GUIDE}).`);
  }
}
