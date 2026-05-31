import Link from "next/link";

const Footer = () => {
  return (
    <footer className="border-border/40 flex flex-col items-center gap-2 border-t p-4 text-center sm:flex-row sm:justify-center sm:gap-4">
      <p className="text-muted-foreground/70 text-xs">
        &copy; {new Date().getFullYear()} Asset Tracker
      </p>
      <div className="flex items-center gap-4">
        <Link
          className="text-muted-foreground/70 hover:text-foreground text-xs transition-colors"
          href="/Privacy"
        >
          Privacy
        </Link>
        <Link
          className="text-muted-foreground/70 hover:text-foreground text-xs transition-colors"
          href="/Terms"
        >
          Terms
        </Link>
        <Link
          className="text-muted-foreground/70 hover:text-foreground text-xs transition-colors"
          href="/Docs"
        >
          Docs
        </Link>
        <Link
          className="text-muted-foreground/70 hover:text-foreground text-xs transition-colors"
          href="/Contact"
        >
          Contact
        </Link>
        <Link
          className="text-muted-foreground/70 hover:text-foreground text-xs transition-colors"
          href="/About"
        >
          GitHub
        </Link>
      </div>
    </footer>
  );
};

export default Footer;
