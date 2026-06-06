import Link from "next/link";

type IconBackLinkProps = {
  href: string;
  ariaLabel: string;
  className?: string;
};

export function IconBackLink({
  href,
  ariaLabel,
  className = "hotel-page-back",
}: IconBackLinkProps) {
  return (
    <Link href={href} className={className} aria-label={ariaLabel}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </Link>
  );
}
