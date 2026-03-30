import type { ReactNode } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchX } from "lucide-react";

interface Column<T> {
  id: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  headClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  footer?: ReactNode;
}

export function DataTable<T>({ columns, rows, getRowKey, emptyTitle = "Nothing to show", emptyDescription = "Try adjusting your filters or add new data.", footer }: DataTableProps<T>) {
  if (!rows.length) {
    return <EmptyState icon={SearchX} title={emptyTitle} description={emptyDescription} className="py-12" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.id} className={column.headClassName}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={getRowKey(row)}>
            {columns.map((column) => (
              <TableCell key={column.id} className={column.className}>
                {column.render(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
      {footer ? <TableFooter>{footer}</TableFooter> : null}
    </Table>
  );
}
