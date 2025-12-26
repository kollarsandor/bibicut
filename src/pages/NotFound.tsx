import { useLocation, Link } from "react-router-dom";
import { useEffect, memo } from "react";
import { Button } from "@/components/ui/ui";

const HomeIcon = memo(function HomeIcon({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
});

function NotFound(): JSX.Element {
  const location = useLocation();

  useEffect(() => {
    console.error(
      `404 Error: Attempted to access non-existent route: ${location.pathname}`
    );
  }, [location.pathname]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center px-4">
        <h1 className="mb-2 text-8xl font-bold text-gradient">404</h1>
        <h2 className="mb-4 text-2xl font-semibold text-foreground">
          Az oldal nem található
        </h2>
        <p className="mb-8 text-lg text-muted-foreground max-w-md mx-auto">
          A keresett oldal nem létezik vagy áthelyezésre került.
        </p>
        <Link 
          to="/"
          className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl text-base font-medium bg-primary text-primary-foreground hover:bg-primary/90 apple-shadow-sm transition-all duration-300 active:scale-[0.97]"
        >
          <HomeIcon className="w-5 h-5" />
          Vissza a főoldalra
        </Link>
      </div>
    </main>
  );
}

export default NotFound;