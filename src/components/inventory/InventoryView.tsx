import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PartItem } from '../../types';
import { formatGBP, formatDateUK } from '../../utils/formatters';
import { 
  Wrench, 
  Plus, 
  AlertTriangle, 
  Package, 
  TrendingDown, 
  TrendingUp, 
  History, 
  Search,
  CheckCircle2,
  X
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const { parts, inventoryMovements, addPart, adjustStock, settings } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingPart, setAdjustingPart] = useState<PartItem | null>(null);

  // New Part form
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Valves & Controls');
  const [unitCost, setUnitCost] = useState(50);
  const [sellingPrice, setSellingPrice] = useState(95);
  const [stockQuantity, setStockQuantity] = useState(10);
  const [minStockLevel, setMinStockLevel] = useState(3);
  const [location, setLocation] = useState('Warehouse Unit 4');

  // Adjust stock form
  const [adjustDelta, setAdjustDelta] = useState(5);
  const [adjustType, setAdjustType] = useState<'restock_purchase' | 'stock_adjustment'>('restock_purchase');
  const [adjustNotes, setAdjustNotes] = useState('Wolseley Trade Counter restock');

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

  const handleSavePart = (e: React.FormEvent) => {
    e.preventDefault();
    addPart({
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
    setShowAddPartModal(false);
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingPart) return;

    adjustStock(
      adjustingPart.id,
      adjustType === 'restock_purchase' ? Number(adjustDelta) : -Number(adjustDelta),
      adjustType,
      adjustNotes
    );
    setShowAdjustModal(false);
  };

  if (!settings.enableInventory) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500 text-xs">
        <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
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
          <Plus className="w-3.5 h-3.5" />
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

      {/* Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search parts by name, SKU, or category..."
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
                <th className="py-2.5 px-3">Item Name & SKU</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Location / Bin</th>
                <th className="py-2.5 px-3 text-right">Unit Cost</th>
                <th className="py-2.5 px-3 text-right">Selling Price</th>
                <th className="py-2.5 px-3 text-right">Stock Level</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
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
                          setAdjustDelta(5);
                          setAdjustType('restock_purchase');
                          setShowAdjustModal(true);
                        }}
                        className="px-2.5 py-1 text-sky-700 hover:text-sky-900 bg-sky-50 border border-sky-200 rounded font-semibold text-xs"
                      >
                        Adjust Stock
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
          {inventoryMovements.map((mov) => {
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
      </div>

      {/* Stock Adjustment Modal */}
      {showAdjustModal && adjustingPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
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
                <label className="block font-semibold text-slate-700 mb-1">Adjustment Type</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-xs"
                >
                  <option value="restock_purchase">Restock Purchase (+ Add)</option>
                  <option value="stock_adjustment">Stock Write-Off / Audit (- Deduct)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason / Supplier Note</label>
                <input
                  type="text"
                  required
                  value={adjustNotes}
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
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Part Modal */}
      {showAddPartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Add Catalogue Item</h3>
              <button
                onClick={() => setShowAddPartModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePart} className="p-5 space-y-3 overflow-y-auto text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Part / Item Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Condensate Drain Neutraliser Kit"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. CDN-022"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit Cost (£) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={unitCost}
                    onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Selling Price (£) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initial Stock Qty</label>
                  <input
                    type="number"
                    required
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Min Reorder Level</label>
                  <input
                    type="number"
                    required
                    value={minStockLevel}
                    onChange={(e) => setMinStockLevel(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Storage Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Warehouse Bin C4 / Van 1"
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
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg text-xs"
                >
                  Add Part
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
