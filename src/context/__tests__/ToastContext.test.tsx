import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from '../ToastContext';

const TestComponent = () => {
  const { showSuccess, showError, showWarning, showInfo, removeToast, clearAllToasts, toasts } = useToast();

  return (
    <div>
      <div data-testid="toast-count">{toasts.length}</div>
      <button onClick={() => showSuccess('Sukses!', 'Operasi berhasil')}>Trigger Success</button>
      <button onClick={() => showError('Gagal!', 'Terjadi kesalahan')}>Trigger Error</button>
      <button onClick={() => showWarning('Peringatan!', 'Harap periksa')}>Trigger Warning</button>
      <button onClick={() => showInfo('Informasi', 'Catatan penting')}>Trigger Info</button>
      <button onClick={() => {
        const id = showSuccess('Temporary', 'Will be removed manually');
        removeToast(id);
      }}>
        Trigger and Remove
      </button>
      <button onClick={clearAllToasts}>Clear All</button>
    </div>
  );
};

describe('ToastContext & ToastProvider', () => {
  it('throws error when useToast is used outside ToastProvider', () => {
    // Suppress console error in test output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow('useToast must be used within a ToastProvider');
    consoleSpy.mockRestore();
  });

  it('renders children and allows showing and closing toasts', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    expect(screen.getByTestId('toast-count').textContent).toBe('0');

    // Trigger Success
    fireEvent.click(screen.getByText('Trigger Success'));
    expect(screen.getByText('Sukses!')).toBeDefined();
    expect(screen.getByText('Operasi berhasil')).toBeDefined();

    // Trigger Error
    fireEvent.click(screen.getByText('Trigger Error'));
    expect(screen.getByText('Gagal!')).toBeDefined();

    // Trigger Warning
    fireEvent.click(screen.getByText('Trigger Warning'));
    expect(screen.getByText('Peringatan!')).toBeDefined();

    // Trigger Info
    fireEvent.click(screen.getByText('Trigger Info'));
    expect(screen.getByText('Informasi')).toBeDefined();

    // Close button on toast
    const closeButtons = screen.getAllByLabelText('Tutup notifikasi');
    expect(closeButtons.length).toBeGreaterThan(0);
    fireEvent.click(closeButtons[0]);

    // Clear all
    fireEvent.click(screen.getByText('Clear All'));
    expect(screen.getByTestId('toast-count').textContent).toBe('0');
  });

  it('auto-dismisses toast after duration expires', () => {
    vi.useFakeTimers();

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Trigger Success'));
    expect(screen.getByText('Sukses!')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(5500);
    });

    expect(screen.queryByText('Sukses!')).toBeNull();
    vi.useRealTimers();
  });
});
