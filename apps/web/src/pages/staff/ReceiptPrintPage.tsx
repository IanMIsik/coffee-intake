import type { ReceiptWithDetails } from "@coffee/shared";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";

export function ReceiptPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<ReceiptWithDetails | null>(null);

  useEffect(() => {
    if (id) api.getReceipt(id).then(setReceipt);
  }, [id]);

  if (!receipt) return <p className="p-6 text-sm text-coffee-400">Loading...</p>;

  return (
    <div className="min-h-screen bg-coffee-50 py-8 px-4 print:bg-white print:p-0">
      <div className="max-w-sm mx-auto bg-white rounded-xl shadow p-6 print:shadow-none print:rounded-none">
        <div className="text-center mb-4">
          <h1 className="font-bold text-lg text-coffee-700">{receipt.organization.name}</h1>
          <p className="text-xs text-coffee-400">Cherry Intake Receipt</p>
        </div>
        <div className="border-t border-b border-dashed py-3 my-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-coffee-400">Receipt #</span>
            <span className="font-semibold">{receipt.receiptNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-coffee-400">Date</span>
            <span>{new Date(receipt.deliveredAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-coffee-400">Farmer</span>
            <span>{receipt.farmer.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-coffee-400">Phone</span>
            <span>{receipt.farmer.phone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-coffee-400">Recorded by</span>
            <span>{receipt.recordedByStaff.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-coffee-400">Status</span>
            <span>{receipt.settled ? "Settled" : "Not yet settled"}</span>
          </div>
        </div>
        <div className="text-center py-3">
          <div className="text-3xl font-bold text-coffee-600">{receipt.weightKg} kg</div>
          <div className="text-xs text-coffee-400">cherry weight</div>
        </div>
        <button
          onClick={() => window.print()}
          className="w-full bg-coffee-600 text-white rounded py-2 mt-4 print:hidden"
        >
          Print
        </button>
      </div>
    </div>
  );
}
