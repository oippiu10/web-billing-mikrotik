const fs = require('fs');
const path = 'c:/laragon/www/shadcn/src/features/finance/billing.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add imports at the top
const imports = `import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  SortingState
} from '@tanstack/react-table'
import { getBillingColumns } from './components/billing-columns'
`;
content = content.replace("import { useState } from 'react'", "import { useState, useMemo } from 'react'\n" + imports);

// 2. Add sorting state and table instance
const tableSetup = `
  const [sorting, setSorting] = useState<SortingState>([])

  const tableData = useMemo(() => data?.data || [], [data?.data])
  
  const columns = useMemo(() => getBillingColumns({
    permissions,
    selectedRows,
    toggleSelectRow,
    toggleSelectAll,
    setHistoryUser,
    setPaidDialog,
    handleWA,
    confirmAction,
    markUnpaid,
    month,
    year,
    dataLength: tableData.length,
    fmt
  }), [permissions, selectedRows, toggleSelectRow, toggleSelectAll, setHistoryUser, setPaidDialog, handleWA, confirmAction, markUnpaid, month, year, tableData.length])

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
`;

// Insert table setup after: const dataLength = (data?.data || []).length
content = content.replace(/const exportUrl =[^]+?\n/m, match => match + tableSetup);

// 3. Replace Table component children
const newTable = `
            <Table>
              <TableHeader className='bg-slate-50/75 dark:bg-slate-900/60 border-b border-border/60'>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      {permissions.canManageFinance && <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>}
                      {permissions.canManageFinance && <TableCell><div className="flex gap-2 justify-center"><Skeleton className="h-8 w-8 rounded-lg" /><Skeleton className="h-8 w-8 rounded-lg" /></div></TableCell>}
                    </TableRow>
                  ))
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(
                        'border-b border-border/30 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-all duration-150',
                        row.original.status === 'paid' && 'bg-emerald-50/10 dark:bg-emerald-950/5 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10',
                        selectedRows.has(row.original.user_id) && 'bg-primary/5 hover:bg-primary/10'
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={cn(!permissions.canManageFinance && cell.column.id === 'username' && 'pl-4')}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className='py-16 text-center text-muted-foreground'
                    >
                      Tidak ada data
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
`;

const tableStartIdx = content.indexOf('<Table>');
const tableEndIdx = content.indexOf('</Table>') + '</Table>'.length;

if (tableStartIdx !== -1 && tableEndIdx !== -1) {
  content = content.slice(0, tableStartIdx) + newTable.trim() + content.slice(tableEndIdx);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Table replaced successfully');
} else {
  console.log('Failed to find <Table>');
}
