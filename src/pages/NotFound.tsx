import { Link } from "react-router-dom";
import { useTitle } from "../lib/title";

export default function NotFound() {
  useTitle("Page not found");
  return (
    <div className="page-head">
      <h1>Page not found</h1>
      <p className="muted">That address doesn't match any page on the site.</p>
      <p>
        <Link to="/">Go to the home page</Link> or <Link to="/learn">browse all lessons</Link>.
      </p>
    </div>
  );
}
