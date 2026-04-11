export type SalesOrderCatalogItem = {
  itemId: string;
  itemName: string;
  description: string;
  rate: number;
};

export type InlineSalesOrderLineDraft = {
  id: string;
  itemId: string;
  itemName: string;
  description: string;
  quantity: number;
  rate: number;
};

export const SALES_ORDER_CATALOG: SalesOrderCatalogItem[] = [
  { itemId: 'LAB-REG', itemName: 'Regular Labor', description: 'Standard diagnostic and repair', rate: 125 },
  { itemId: 'LAB-EMR', itemName: 'Emergency Labor', description: 'Emergency diagnostic and repair', rate: 195 },
  { itemId: 'LAB-AH', itemName: 'After-Hours Labor', description: 'After-hours emergency response labor', rate: 195 },
  { itemId: 'LAB-REP', itemName: 'Repair Labor', description: 'Diagnostics and replacement labor', rate: 145 },
  { itemId: 'LAB-TRAV', itemName: 'Travel Charge', description: 'Trip/travel fee', rate: 75 },
  { itemId: 'PM-HVAC', itemName: 'PM – HVAC', description: 'Quarterly rooftop preventive maintenance', rate: 360 },
  { itemId: 'PM-MAU', itemName: 'PM – Make-Up Air', description: 'MAU: filters, belts, combustion review', rate: 540 },
  { itemId: 'INSP-STD', itemName: 'Standard Inspection', description: 'Scheduled inspection and written report', rate: 185 },
  { itemId: 'INSP-BOI', itemName: 'Boiler Inspection', description: 'Annual combustion report', rate: 195 },
  { itemId: 'CTL-RESET', itemName: 'Controls Reset', description: 'BMS recommissioning', rate: 220 },
  { itemId: 'VFD-TUNE', itemName: 'VFD Tuning', description: 'Controller tune and verification', rate: 280 },
  { itemId: 'AIR-BAL', itemName: 'Air Balance Service', description: 'Exhaust balancing and pressure verification', rate: 760 },
  { itemId: 'STARTUP', itemName: 'Startup & Commissioning', description: 'Install startup package', rate: 980 },
  { itemId: 'FLT-SET', itemName: 'Filter Set (MERV 13)', description: 'MERV 13 replacement filters (each)', rate: 58 },
  { itemId: 'COMP-01', itemName: 'Compressor Replacement', description: 'Compressor swap and installation', rate: 1240 },
  { itemId: 'FAN-EVAP', itemName: 'Evaporator Fan Motor', description: 'Evaporator fan motor swap', rate: 420 },
  { itemId: 'IGN-MOD', itemName: 'Ignition Module', description: 'Heating ignition module replacement', rate: 235 },
  { itemId: 'REF-404A', itemName: 'Refrigerant R-404A', description: 'R-404A refrigerant refill (per lb)', rate: 42 },
  { itemId: 'REF-410A', itemName: 'Refrigerant R-410A', description: 'R-410A refrigerant refill (per lb)', rate: 35 },
  { itemId: 'MISC-PARTS', itemName: 'Misc. Parts & Materials', description: 'Miscellaneous parts and materials', rate: 0 },
];

export function createInlineSalesOrderLine(item: SalesOrderCatalogItem): InlineSalesOrderLineDraft {
  return {
    id: `inline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    itemId: item.itemId,
    itemName: item.itemName,
    description: item.description,
    quantity: 1,
    rate: item.rate,
  };
}
