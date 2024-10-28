import React from "react";
import Link from "next/link";

const Footer = () => {
  return (
    <footer className="flex flex-row justify-center gap-4 p-4 text-center text-gray-600">
      <p>© 2024 Asset Tracker</p>
      <Link className="hover:text-gray-400" href="/Privacy">
        Privacy
      </Link>
      <Link className="hover:text-gray-400" href="/Terms">
        Terms
      </Link>
      <Link className="hover:text-gray-400" href="/Docs">
        Docs
      </Link>
      <Link className="hover:text-gray-400" href="/Contact">
        Contact
      </Link>
      <Link className="hover:text-gray-400" href="/About">
        GitHub
      </Link>
    </footer>
  );
};

export default Footer;
