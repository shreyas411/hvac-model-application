import React, { useState } from 'react';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { InventoryMovement, PartItem } from '../../types';
import { formatGBP, formatDateUK } from '../../utils/formatters';
import { useEscape } from '../../utils/useEscape';
import { IconArrowsExchange, IconPackage, IconPlus, IconSearch } from '@tabler/icons-react';
import { useServerPaged } from '../common/Pager';

export const InventoryView: React.FC = () => {
  const { parts, inventoryMovements, addPart, adjustStock, deletePart, settings } = useApp(['parts', 'inventoryMovements', 'addPart', 'adjustStock', 'deletePart', 'settings']);
  const paged = useServerPaged<InventoryMovement>('/movements', {}, inventoryMovements);

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingPart, setAdjustingPart] = useState<PartItem | null>(null);

  // New Part form
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Valves & Controls');
  const [unitCost, setUnitCost] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [minStockLevel, setMinStockLevel] = useState('');
  const [location, setLocation] = useState('');

  // Adjust stock form
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustType, setAdjustType] = useState<'restock_purchase' | 'stock_adjustment'>('restock_purchase');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [busy, setBusy] = useState(false); // guards double-submit

  const filteredParts = parts.filter((p) => {
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  useEscape(showAddPartModal || showAdjustModal, () => { setShowAddPartModal(false); setShowAdjustModal(false); });

  const handleSavePart = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const created = await addPart({
      name,
      sku,
      description,
      category,
      unitCost: Number(unitCost),
      sellingPrice: Number(sellingPrice),
      stockQuantity: Number(stockQuantity),
      minStockLevel: Number(minStockLevel),
      location,
    });
    setBusy(false);
    if (!created) return;
    setName(''); setSku(''); setDescription(''); setUnitCost(''); setSellingPrice(''); setStockQuantity(''); setMinStockLevel(''); setLocation('');
    setShowAddPartModal(false);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingPart) return;

    setBusy(true);
    const ok = await adjustStock(
      adjustingPart.id,
      adjustType === 'restock_purchase' ? Number(adjustDelta) : -Number(adjustDelta),
      adjustType,
      adjustNotes
    );
    setBusy(false);
    if (!ok) return; // keep the modal open so the input isn't lost
    setAdjustNotes('');
    setShowAdjustModal(false);
  };

  if (!settings.enableInventory) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500 text-xs">
        <IconPackage className="w-8 h-8 text-slate-300 mx-auto mb-2" aria-hidden="true" />
        <h2 className="text-base font-bold text-slate-800">Inventory Tracking Disabled</h2>
        <p className="mt-1">Inventory management is currently disabled in Company Settings.</p>
      </div>
    );
  }

  const lowStockCount = parts.filter((p) => p.stockQuantity <= p.minStockLevel).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            HVAC Parts & Inventory Catalogue
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Van inventory tracking, low-stock warnings, purchase restocking, and consumption audit trails
          </p>
        </div>

        <button
          onClick={() => setShowAddPartModal(true)}
          className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center gap-1.5 shrink-0"
        >
          <IconPlus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Add Catalogue Item</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs font-medium text-slate-500">Catalogue Items</span>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-1">{parts.length}</p>
          <span className="text-[11px] text-slate-400">Standard HVAC spares</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs font-medium text-slate-500">Low Stock Warnings</span>
          <p className="text-2xl font-bold font-mono text-amber-600 mt-1">{lowStockCount}</p>
          <span className="text-[11px] text-amber-700 font-medium">At or below reorder threshold</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <span className="text-xs font-medium text-slate-500">Total Stock Valuation</span>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
            {formatGBP(parts.reduce((sum, p) => sum + p.stockQuantity * p.unitCost, 0))}
          </p>
          <span className="text-[11px] text-slate-400">At wholesale unit cost</span>
        </div>
      </div>

      {/* IconSearch Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <IconSearch className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search parts" name="search" autoComplete="off" placeholder="Search parts by name, SKU, or category…"
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* Parts Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-medium">
              <tr>
                <th scope="col" className="py-2.5 px-3">Item Name & SKU</th>
                <th scope="col" className="py-2.5 px-3">Category</th>
                <th scope="col" className="py-2.5 px-3">Location / Bin</th>
                <th scope="col" className="py-2.5 px-3 text-right">Unit Cost</th>
                <th scope="col" className="py-2.5 px-3 text-right">Selling Price</th>
                <th scope="col" className="py-2.5 px-3 text-right">Stock Level</th>
                <th scope="col" className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParts.length === 0 && <tr><td colSpan={7} className="py-6"><EmptyState icon={IconPackage}>No parts found.</EmptyState></td></tr>}
              {filteredParts.map((part) => {
                const isLow = part.stockQuantity <= part.minStockLevel;

                return (
                  <tr key={part.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 block">{part.name}</span>
                      <span className="font-mono text-[11px] text-slate-500 block">{part.sku}</span>
                    </td>

                    <td className="py-3 px-3 text-slate-700">{part.category}</td>

                    <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">{part.location}</td>

                    <td className="py-3 px-3 text-right font-mono text-slate-600">{formatGBP(part.unitCost)}</td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{formatGBP(part.sellingPrice)}</td>

                    <td className="py-3 px-3 text-right">
                      <span className={`font-mono font-bold ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>
                        {part.stockQuantity}
                      </span>
                      {isLow && (
                        <span className="text-[10px] text-rose-700 font-semibold block">
                          Low (Min {part.minStockLevel})
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => {
                          setAdjustingPart(part);
                          setAdjustDelta('');
                          setAdjustType('restock_purchase');
                          setShowAdjustModal(true);
                        }}
                        aria-label={`Adjust stock for ${part.name}`} className="px-2.5 py-1 text-sky-700 hover:text-sky-900 bg-sky-50 border border-sky-200 rounded font-semibold text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        Adjust Stock
                      </button>
                      <button
                        onClick={() => window.confirm(`Delete ${part.name}? Parts with stock history can't be deleted.`) && void deletePart(part.id)}
                        aria-label={`Delete ${part.name}`} className="ml-2 px-2.5 py-1 text-rose-700 hover:text-rose-900 bg-rose-50 border border-rose-200 rounded font-semibold text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movement History Log */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <h3 className="font-bold text-sm text-slate-900">Recent Inventory Movement Log</h3>
        <div className="divide-y divide-slate-100 overflow-x-auto text-xs">
          {inventoryMovements.length === 0 && <EmptyState icon={IconArrowsExchange} compact>No stock movements yet.</EmptyState>}
          {paged.rows.map((mov) => {
            const part = parts.find((p) => p.id === mov.partId);
            return (
              <div key={mov.id} className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <span className="font-semibold text-slate-900">{part?.name || 'Part'}</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">{mov.notes}</p>
                </div>
                <div className="text-right whitespace-nowrap">
                  <span className={`font-mono font-bold ${mov.quantityDelta > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {mov.quantityDelta > 0 ? `+${mov.quantityDelta}` : mov.quantityDelta}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    {formatDateUK(mov.timestamp)} by {mov.userName}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {paged.pager}
      </div>

      {/* Stock Adjustment Modal */}
      {showAdjustModal && adjustingPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Adjust stock">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-slate-200 p-5 space-y-4 text-xs">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Adjust Stock - {adjustingPart.name}
              </h3>
              <p className="text-slate-500 mt-0.5">
                Current Level: <strong className="font-mono">{adjustingPart.stockQuantity}</strong>
              </p>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-3">
              <div>
                <label htmlFor="adj-type" className="block font-semibold text-slate-700 mb-1">Adjustment Type</label>
                <select
                  id="adj-type" value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs"
                >
                  <option value="restock_purchase">Restock Purchase (+ Add)</option>
                  <option value="stock_adjustment">Stock Write-Off / Audit (- Deduct)</option>
                </select>
              </div>

              <div>
                <label htmlFor="adj-qty" className="block font-semibold text-slate-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  id="adj-qty" name="quantity" inputMode="numeric" max={adjustType === 'stock_adjustment' ? adjustingPart.stockQuantity : undefined} value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                />
              </div>

              <div>
                <label htmlFor="adj-notes" className="block font-semibold text-slate-700 mb-1">Reason / Supplier Note</label>
                <input
                  type="text"
                  required
                  id="adj-notes" name="notes" autoComplete="off" placeholder="e.g. supplier or reason for write-off…" value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg disabled:opacity-60"
                >
                  {busy ? 'Saving…' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Part Modal */}
      {showAddPartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Add catalogue item">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Add Catalogue Item</h3>
              <button
                onClick={() => setShowAddPartModal(false)}
                aria-label="Close" className="p-1 text-slate-400 hover:text-slate-600"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <form onSubmit={handleSavePart} className="p-5 space-y-3 overflow-y-auto text-xs">
              <div>
                <label htmlFor="p-name" className="block font-semibold text-slate-700 mb-1">Part / Item Name *</label>
                <input
                  type="text"
                  required
                  id="p-name" name="name" autoComplete="off" value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Condensate Drain Neutraliser Kit"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="p-sku" className="block font-semibold text-slate-700 mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    id="p-sku" name="sku" autoComplete="off" spellCheck={false} value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. CDN-022"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="p-cat" className="block font-semibold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    id="p-cat" name="category" value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="p-cost" className="block font-semibold text-slate-700 mb-1">Unit Cost (£) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    id="p-cost" name="unitCost" min="0" inputMode="decimal" value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="p-price" className="block font-semibold text-slate-700 mb-1">Selling Price (£) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    id="p-price" name="sellingPrice" min="0" inputMode="decimal" value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="p-stock" className="block font-semibold text-slate-700 mb-1">Initial Stock Qty</label>
                  <input
                    type="number"
                    required
                    id="p-stock" name="stock" min="0" inputMode="numeric" value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="p-min" className="block font-semibold text-slate-700 mb-1">Min Reorder Level</label>
                  <input
                    type="number"
                    required
                    id="p-min" name="minStock" min="0" inputMode="numeric" value={minStockLevel}
                    onChange={(e) => setMinStockLevel(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="p-loc" className="block font-semibold text-slate-700 mb-1">Storage Location</label>
                <input
                  type="text"
                  id="p-loc" name="location" autoComplete="off" value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Warehouse Bin C4 / Van 1…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPartModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg text-xs disabled:opacity-60"
                >
                  {busy ? 'Adding…' : 'Add Part'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
