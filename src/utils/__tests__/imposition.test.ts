import { describe, it, expect } from 'vitest';
import { calculateImposition } from '../imposition';
import { BookletOptions } from '../../types/booklet';

const defaultOptions: BookletOptions = {
  gutterMarginMm: 5,
  outerMarginMm: 10,
  marginMm: 10,
  showFoldLine: false,
  scaleMode: 'fit',
  alignment: 'center',
  sourceDimensionPreset: 'a5',
  customSourceWidthMm: 148,
  customSourceHeightMm: 210,
  compressionLevel: 'none',
  autoCropWhiteMargins: false,
  cropPaddingMm: 3,
  cropThreshold: 245,
  blankPlacement: 'end',
};

describe('calculateImposition', () => {
  it('correctly calculates 2-up imposition for an exact 4-page document', () => {
    const result = calculateImposition(4, defaultOptions);

    expect(result.metadata.originalPageCount).toBe(4);
    expect(result.metadata.paddedPageCount).toBe(4);
    expect(result.metadata.blankPagesAdded).toBe(0);
    expect(result.metadata.totalSheets).toBe(1);
    expect(result.sheets).toHaveLength(1);

    const sheet1 = result.sheets[0];
    // Sheet 1 Front: Left = Page 4, Right = Page 1
    expect(sheet1.front.leftPage.pageNumber).toBe(4);
    expect(sheet1.front.rightPage.pageNumber).toBe(1);
    expect(sheet1.front.leftPage.isBackCover).toBe(true);
    expect(sheet1.front.rightPage.isCover).toBe(true);

    // Sheet 1 Back: Left = Page 2, Right = Page 3
    expect(sheet1.back.leftPage.pageNumber).toBe(2);
    expect(sheet1.back.rightPage.pageNumber).toBe(3);
  });

  it('correctly calculates 2-up imposition for an 8-page document', () => {
    const result = calculateImposition(8, defaultOptions);

    expect(result.metadata.originalPageCount).toBe(8);
    expect(result.metadata.paddedPageCount).toBe(8);
    expect(result.metadata.totalSheets).toBe(2);
    expect(result.sheets).toHaveLength(2);

    // Sheet 1 (Outer sheet)
    // Front: [8, 1]
    expect(result.sheets[0].front.leftPage.pageNumber).toBe(8);
    expect(result.sheets[0].front.rightPage.pageNumber).toBe(1);
    // Back: [2, 7]
    expect(result.sheets[0].back.leftPage.pageNumber).toBe(2);
    expect(result.sheets[0].back.rightPage.pageNumber).toBe(7);

    // Sheet 2 (Inner sheet)
    // Front: [6, 3]
    expect(result.sheets[1].front.leftPage.pageNumber).toBe(6);
    expect(result.sheets[1].front.rightPage.pageNumber).toBe(3);
    // Back: [4, 5]
    expect(result.sheets[1].back.leftPage.pageNumber).toBe(4);
    expect(result.sheets[1].back.rightPage.pageNumber).toBe(5);
  });

  it('pads pages to nearest multiple of 4 when original page count is 5', () => {
    const result = calculateImposition(5, defaultOptions);

    expect(result.metadata.originalPageCount).toBe(5);
    expect(result.metadata.paddedPageCount).toBe(8);
    expect(result.metadata.blankPagesAdded).toBe(3);
    expect(result.metadata.totalSheets).toBe(2);
  });

  it('handles blankPlacement="end" properly with blank pages at the end', () => {
    const options: BookletOptions = {
      ...defaultOptions,
      blankPlacement: 'end',
    };
    const result = calculateImposition(6, options);

    // Padded to 8: pages are [1, 2, 3, 4, 5, 6, null, null]
    // Sheet 1 Front: Left = virtual slot 8 (null/blank), Right = virtual slot 1 (page 1)
    expect(result.sheets[0].front.leftPage.isBlank).toBe(true);
    expect(result.sheets[0].front.leftPage.pageNumber).toBeNull();
    expect(result.sheets[0].front.rightPage.pageNumber).toBe(1);

    // Sheet 1 Back: Left = page 2, Right = virtual slot 7 (null/blank)
    expect(result.sheets[0].back.leftPage.pageNumber).toBe(2);
    expect(result.sheets[0].back.rightPage.isBlank).toBe(true);
  });

  it('handles blankPlacement="before-back-cover" so page 6 remains on the back cover', () => {
    const options: BookletOptions = {
      ...defaultOptions,
      blankPlacement: 'before-back-cover',
    };
    const result = calculateImposition(6, options);

    // In 6 pages padded to 8: sequence is [1, 2, 3, 4, 5, null, null, 6]
    // Sheet 1 Front Left is slot 8 -> original page 6 (Back Cover)
    expect(result.sheets[0].front.leftPage.pageNumber).toBe(6);
    expect(result.sheets[0].front.leftPage.isBackCover).toBe(true);
    expect(result.sheets[0].front.rightPage.pageNumber).toBe(1);
    expect(result.sheets[0].front.rightPage.isCover).toBe(true);
  });

  it('labels pages correctly (Sampul Depan, Sampul Belakang, Halaman Kosong)', () => {
    const result = calculateImposition(4, defaultOptions);

    expect(result.sheets[0].front.rightPage.label).toContain('Sampul Depan');
    expect(result.sheets[0].front.leftPage.label).toContain('Sampul Belakang');
    expect(result.sheets[0].back.leftPage.label).toBe('Halaman 2');
    expect(result.sheets[0].back.rightPage.label).toBe('Halaman 3');
  });

  it('handles 1 page document by padding to 4 pages', () => {
    const result = calculateImposition(1, defaultOptions);

    expect(result.metadata.paddedPageCount).toBe(4);
    expect(result.metadata.blankPagesAdded).toBe(3);
    expect(result.metadata.totalSheets).toBe(1);
    expect(result.sheets[0].front.rightPage.pageNumber).toBe(1);
    expect(result.sheets[0].front.leftPage.isBlank).toBe(true);
  });
});
