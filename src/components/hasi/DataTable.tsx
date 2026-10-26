import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type Col<T> = { header: string; cell: (row: T) => ReactNode; className?: string };

export function DataTable<T extends { id: string | number }>({ rows, cols }: { rows: T[]; cols: Col<T>[] }) {
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {cols.map((c) => (
              <TableHead key={c.header} className="label-mono h-9">{c.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              {cols.map((c) => (
                <TableCell key={c.header} className={c.className ?? "text-sm"}>{c.cell(r)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
