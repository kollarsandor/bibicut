import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

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
        <Button asChild size="lg">
          <Link to="/">
            <Home className="mr-2 h-5 w-5" />
            Vissza a főoldalra
          </Link>
        </Button>
      </div>
    </main>
  );
}

export default NotFound;
