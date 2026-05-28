const fs = require('fs');
const path = 'c:/laragon/www/shadcn/src/features/finance/billing.tsx';
let content = fs.readFileSync(path, 'utf8');
let lines = content.split('\n');

// Import at the top
lines.splice(78, 0, "import { printBulkThermal, printThermal, printBulkInvoice, printInvoice } from './utils/print-templates'");

// Update the bulk print onClick handlers first
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('onClick={printBulkThermal}')) {
    lines[i] = `                onClick={() => {
                  const usersToPrint = (data?.data || []).filter((r: any) => selectedRows.has(r.user_id))
                  printBulkThermal(usersToPrint, month, year)
                }}`;
  }
  if (lines[i].includes('onClick={printBulkInvoice}')) {
    lines[i] = `                onClick={() => {
                  const usersToPrint = (data?.data || []).filter((r: any) => selectedRows.has(r.user_id))
                  printBulkInvoice(usersToPrint, month, year)
                }}`;
  }
}

// Now find the start and end of the print functions block
let startIdx = lines.findIndex(l => l.includes('const printBulkThermal = () => {'));
let endIdx = lines.findIndex(l => l.includes('const printInvoice = (row: any, month: number, year: number) => {'));

if (startIdx !== -1 && endIdx !== -1) {
    // Find the end of printInvoice. It ends before const summary = data?.summary
    let realEndIdx = lines.findIndex((l, i) => i > endIdx && l.includes('const summary = data?.summary'));
    if (realEndIdx !== -1) {
        // Delete from startIdx to realEndIdx - 1
        lines.splice(startIdx, realEndIdx - startIdx);
    }
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Successfully updated billing.tsx');
