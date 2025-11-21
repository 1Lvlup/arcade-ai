import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-primary/10 bg-background/50 backdrop-blur-sm mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Level Up. All rights reserved.
          </p>
          <nav className="flex gap-6">
            <Link 
              to="/what-is-level-up" 
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              What Is Level Up?
            </Link>
            <Link 
              to="/privacy-policy" 
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Privacy Policy
            </Link>
            <Link 
              to="/support" 
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Contact Support
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
