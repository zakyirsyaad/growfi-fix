import { Card, CardTitle } from "@/components/ui/card";

export type TransactionView = {
  id: string;
  type: string;
  amount: number;
  signature?: string | null;
  status: string;
  createdAt: string;
};

export function TransactionList({
  transactions,
}: {
  transactions: TransactionView[];
}) {
  return (
    <Card>
      <CardTitle className="mb-3">Transactions</CardTitle>
      <div className="space-y-2">
        {transactions.length === 0 ? (
          <div className="text-sm font-bold text-leaf-800">
            No transactions yet.
          </div>
        ) : null}
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="grid gap-2 rounded-lg bg-white/65 px-3 py-2 text-sm sm:grid-cols-[1fr_auto_auto]"
          >
            <div>
              <div className="font-black">
                {tx.type.toLowerCase().replaceAll("_", " ")}
              </div>
              <div className="text-xs font-bold text-leaf-700">
                {new Date(tx.createdAt).toLocaleString()}
              </div>
            </div>
            <div className="font-black">{tx.amount}</div>
            <div className="text-xs font-black uppercase text-leaf-700">
              {tx.status}
            </div>
            {tx.signature ? (
              <div className="break-all text-xs font-bold text-leaf-700 sm:col-span-3">
                {tx.signature}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
