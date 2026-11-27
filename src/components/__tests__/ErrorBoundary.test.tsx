import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

const CrashingChild: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Simulasi galat render');
  }
  return <div data-testid="healthy-child">Konten sehat</div>;
};

describe('ErrorBoundary', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('catches render errors, displays boxy fallback UI, and recovers via Muat Ulang Panel button', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onReset = vi.fn();

    let throwFlag = true;
    const DynamicChild = () => {
      if (throwFlag) throw new Error('Boom');
      return <div data-testid="recovered-child">Berhasil pulih</div>;
    };

    render(
      <ErrorBoundary
        title="Panel uji gagal"
        description="Deskripsi pemulihan."
        onReset={onReset}
      >
        <DynamicChild />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('error-boundary-fallback')).toBeTruthy();
    expect(screen.getByText('Panel uji gagal')).toBeTruthy();
    expect(screen.getByText('Deskripsi pemulihan.')).toBeTruthy();

    throwFlag = false;
    fireEvent.click(screen.getByRole('button', { name: /Muat Ulang Panel/i }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('recovered-child')).toBeTruthy();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('automatically recovers when resetKey prop changes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <ErrorBoundary resetKey="doc-1">
        <CrashingChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('error-boundary-fallback')).toBeTruthy();

    rerender(
      <ErrorBoundary resetKey="doc-2">
        <CrashingChild shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('healthy-child')).toBeTruthy();
  });
});
