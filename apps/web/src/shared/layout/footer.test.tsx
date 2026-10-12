import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Footer } from './footer.js';

describe('Footer', () => {
  it('renders the exact copyright text with the current year', () => {
    const year = new Date().getFullYear();
    const markup = renderToStaticMarkup(<Footer />);
    const expected =
      '© ' +
      year +
      ' Team 27 (DM Vikas, Karan H, Rohan G), NITK Surathkal. Developed for the Software Engineering course.';

    expect(markup).toContain(expected);
  });
});
