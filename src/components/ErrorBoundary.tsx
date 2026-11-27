import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  resetKey?: string | number;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * React Error Boundary bergaya boxy Swiss prepress.
 * Mengisolasi kesalahan runtime (misalnya render PDF atau konteks WebGL 3D)
 * agar tidak membuat seluruh aplikasi blank/crash.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught render error:', error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      const title = this.props.title ?? 'Terjadi kendala saat menampilkan panel ini';
      const description =
        this.props.description ??
        'Komponen mengalami gangguan sementara. Data berkas Anda tetap aman — muat ulang panel ini untuk melanjutkan.';

      return (
        <div
          role="alert"
          data-testid="error-boundary-fallback"
          className="bg-white dark:bg-[#161616] border-2 border-[#D9381E] dark:border-[#F04A2E] p-6 flex flex-col items-start gap-3"
        >
          <div className="flex items-center gap-2 text-[#D9381E] dark:text-[#F04A2E]">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h3 className="font-display text-sm sm:text-base font-bold text-neutral-950 dark:text-white">
              {title}
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-xl">
            {description}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-1 h-9 px-4 bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 hover:bg-[#D9381E] dark:hover:bg-[#F04A2E] dark:hover:text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Muat Ulang Panel</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
