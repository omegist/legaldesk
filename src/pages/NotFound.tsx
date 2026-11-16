import { useNavigate } from "react-router-dom";
import { Scale, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background legal-pattern flex flex-col items-center justify-center px-6 text-center">
      <Scale className="h-16 w-16 text-primary/30 mb-6" />
      <h1 className="font-serif text-6xl font-bold text-gold-gradient mb-4">404</h1>
      <p className="text-xl text-muted-foreground mb-2">Page not found</p>
      <p className="text-sm text-muted-foreground mb-8 max-w-md">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Go back
        </Button>
        <Button onClick={() => navigate('/dashboard')} className="gold-gradient text-primary-foreground">
          Dashboard
        </Button>
      </div>
    </div>
  );
}
