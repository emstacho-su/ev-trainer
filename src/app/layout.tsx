import "./globals.css";
import ThemeModeToggle from "../components/ThemeModeToggle";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var m=localStorage.getItem('ev-theme-mode');if(m==='light'||m==='dark'){document.documentElement.setAttribute('data-theme',m);}else{document.documentElement.removeAttribute('data-theme');}}catch(_){}})();",
          }}
        />
      </head>
      <body>
        <div className="app-shell-root">
          <header className="app-shell-header">
            <ThemeModeToggle />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
