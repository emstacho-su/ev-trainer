import { ThemeProvider } from './providers/ThemeProvider';
import { AnimationProvider } from './providers/AnimationProvider';
import { AuthProvider } from './providers/AuthProvider';
import { ToastProvider } from '@/lib/ui/toastContext';
import ToastContainer from '@/lib/ui/ToastContainer';
import AppHeader from '@/components/AppHeader';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AnimationProvider>
            <AuthProvider>
              <ToastProvider>
                <AppHeader />
                {children}
                <ToastContainer />
              </ToastProvider>
            </AuthProvider>
          </AnimationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
