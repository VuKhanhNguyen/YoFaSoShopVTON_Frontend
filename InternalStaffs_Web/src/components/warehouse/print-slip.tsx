"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

export function PrintStockSlip({ title, lines }: { title: string; lines: string[] }) {
  const [printing, setPrinting] = useState(false);
  return <>
    <Button variant="outline" onClick={() => {
      setPrinting(true);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.print();
        setPrinting(false);
      }));
    }}>In phiếu / Lưu PDF</Button>
    {printing && createPortal(
      <div className="print-sheet"><article className="picking-slip">
        <h1>{title}</h1>
        {lines.map((line, index) => <p key={index}>{line}</p>)}
      </article></div>, document.body)}
  </>;
}
