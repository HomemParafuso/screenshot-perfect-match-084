import { Link } from "@tanstack/react-router";

export const UserLink = ({ id, email }: { id?: string | null; email?: string | null }) =>
  id && email ? (
    <Link to="/users/$id" params={{ id }} className="hover:text-primary">{email}</Link>
  ) : (
    <span className="text-muted-foreground">{email ?? "—"}</span>
  );
