import React from "react";
interface Props { capacityVal: number; capacityUnit: "kWp" | "MWp"; displayUnit: "W" | "kW" | "MW"; }
export const NormalizationBanner: React.FC<Props> = ({ capacityVal, capacityUnit }) => <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4 text-sm text-slate-300">Forecasts are shown for <span className="font-semibold text-white">{capacityVal.toLocaleString("en-US", { maximumFractionDigits: 1 })} {capacityUnit === "kWp" ? "kW" : "MW"}</span> of solar capacity.</div>;
