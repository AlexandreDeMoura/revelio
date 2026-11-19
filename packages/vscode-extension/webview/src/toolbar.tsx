// The bar along the top of every page: where the page is, then the search, Overview and Changes.
// The search and Changes do nothing yet: they wait for the pages they open.
import type { ReactNode } from "react";
import { GitBranch, Grid, Search } from "./icons";

export function Toolbar({
  crumbs,
  onOverview,
  children,
}: {
  crumbs: ReactNode;
  // Opens the Overview. Without it, the page is the Overview.
  onOverview?: () => void;
  // The page's own buttons, after Changes.
  children?: ReactNode;
}) {
  return (
    <div className="toolbar">
      <nav aria-label="Where you are" className="crumbs">
        {crumbs}
      </nav>
      <div className="toolbar-actions">
        <button type="button" className="icon-button" aria-label="Go to a Flow or Part">
          <Search />
        </button>
        {onOverview ? (
          <button type="button" className="toolbar-link" onClick={onOverview}>
            <Grid />
            Overview
          </button>
        ) : (
          <span className="toolbar-link current" aria-current="page">
            <Grid />
            Overview
          </span>
        )}
        <button type="button" className="toolbar-link">
          <GitBranch />
          Changes
        </button>
        {children}
      </div>
    </div>
  );
}
