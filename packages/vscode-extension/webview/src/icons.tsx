// Line icons on a 16px grid, drawn in the text colour around them. Every one is decoration:
// the control or text beside it carries the meaning.
import type { ReactNode } from "react";

function icon(paths: ReactNode, { fill = false } = {}) {
  return function Icon({ size = 16, className }: { size?: number; className?: string }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill={fill ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
      >
        {paths}
      </svg>
    );
  };
}

export const AppIcon = icon(
  <>
    <rect x="2.5" y="2.5" width="11" height="11" rx="3" />
    <rect x="6" y="6" width="4" height="4" rx="1" fill="currentColor" stroke="none" />
  </>,
);
export const ChevronRight = icon(<path d="M6 4l4 4-4 4" />);
export const ChevronDown = icon(<path d="M4.5 6.5L8 10l3.5-3.5" />);
export const Search = icon(
  <>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </>,
);
export const Grid = icon(
  <>
    <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
    <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
    <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
    <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
  </>,
);
export const GitBranch = icon(
  <>
    <circle cx="5" cy="3.5" r="1.5" />
    <circle cx="5" cy="12.5" r="1.5" />
    <circle cx="11" cy="5.5" r="1.5" />
    <path d="M5 5v6M11 7c0 2.5-3 2.5-6 4" />
  </>,
);
export const ArrowLeft = icon(<path d="M13 8H3M7 4L3 8l4 4" />);
export const ArrowRight = icon(<path d="M3 8h10M9 4l4 4-4 4" />);
export const ArrowDown = icon(<path d="M8 2.5v10M5 9.5l3 3 3-3" />);
export const Commit = icon(
  <>
    <circle cx="8" cy="8" r="2.5" />
    <path d="M1.5 8h4M10.5 8h4" />
  </>,
);
export const File = icon(
  <>
    <path d="M4 2h5l3 3v9H4z" />
    <path d="M9 2v3h3" />
  </>,
);
export const Fork = icon(<path d="M5 2.5v11M11 2.5v2a3 3 0 01-3 3H5" />);
export const Chat = icon(<path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />);
export const OpenBeside = icon(<path d="M9 2.5h4.5V7M13.5 2.5L7.5 8.5M12 9.5v4H2.5V4h4" />);
export const Check = icon(<path d="M3 8.5l3 3 7-7" />);
