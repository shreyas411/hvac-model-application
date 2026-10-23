import React, { useState } from 'react';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { InventoryMovement, PartItem } from '../../types';
import { formatGBP, formatDateUK } from '../../utils/formatters';
import { IconAdjustments, IconArrowsExchange, IconCancel, IconCheck, IconPackage, IconPlus, IconSearch, IconTrash, IconX } from '@tabler/icons-react';
import { DetailDrawer } from '../common/DetailDrawer';
import { RowActions } from '../common/RowActions';
import { TableCard } from '../common/TableCard';
import { useServerPaged } from '../common/Pager';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { FormDialog } from '../common/FormDialog';
import { Card } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';

export const InventoryView: React.FC = () => {
  const { parts, inventoryMovements, addPart, updatePart, adjustStock, deletePart, settings, confirmToast } = useApp(['parts', 'inventoryMovements', 'addPart', 'updatePart', 'adjustStock', 'deletePart', 'settings', 'confirmToast']);
  const paged = useServerPaged<InventoryMovement>('/movements', {}, inventoryMovements);

  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'inactive'>('all');
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
    if (stockFilter === 'low' && !(p.stockQuantity <= p.minStockLevel)) return false;
    if (stockFilter === 'inactive' && !p.inactive) return false;
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
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-muted-foreground text-xs">
        <IconPackage className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" aria-hidden="true" />
        <h2 className="text-base font-bold text-foreground">Inventory Tracking Disabled</h2>
        <p className="mt-1">Inventory management is currently disabled in Company Settings.</p>
      </div>
    );
  }

  const lowStockCount = parts.filter((p) => p.stockQuantity <= p.minStockLevel).length;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-2 space-y-3">

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-bold tracking-tight">
            HVAC Parts & Inventory Catalogue
          </h1>
            <Badge variant="secondary" className="text-base tabular-nums" aria-live="polite" aria-label={`${filteredParts.length} ${filteredParts.length === 1 ? 'part' : 'parts'}`}>{filteredParts.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Van inventory tracking, low-stock warnings, purchase restocking, and consumption audit trails
          </p>
        </div>

        <Button size="sm" onClick={() => setShowAddPartModal(true)} className="shrink-0">
          <IconPlus aria-hidden="true" />
          <span>Add Catalogue Item</span>
        </Button>
      </div>

      {/* Stock summary: one compact strip */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-1 rounded-lg border border-border bg-card px-4 py-2 text-xs">
        <span className="text-muted-foreground">Catalogue items <strong className="ml-1 text-sm tabular-nums text-foreground">{parts.length}</strong></span>
        <span className="text-muted-foreground">Low stock <strong className="ml-1 text-sm tabular-nums text-amber-700">{lowStockCount}</strong></span>
        <span className="text-muted-foreground">Stock valuation (at cost) <strong className="ml-1 text-sm tabular-nums text-foreground">{formatGBP(parts.reduce((sum, p) => sum + p.stockQuantity * p.unitCost, 0))}</strong></span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <IconSearch className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" aria-hidden="true" />
          <Input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Search parts" name="search" autoComplete="off" placeholder="Search name, SKU, category…" className="pl-9 h-8 text-xs" />
        </div>
        <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as typeof stockFilter)}>
          <SelectTrigger size="sm" aria-label="Stock filter" className="w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stock</SelectItem>
            <SelectItem value="low">Low stock</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {(searchTerm || stockFilter !== 'all') && <Button variant="ghost" size="xs" onClick={() => { setSearchTerm(''); setStockFilter('all'); }}><IconX aria-hidden="true" />Clear filters</Button>}
      </div>

      {/* Parts Table */}
      <div style={{ '--table-offset': '26rem' } as React.CSSProperties}><TableCard>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>Item Name & SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Location / Bin</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">Selling Price</TableHead>
              <TableHead className="text-right">Stock Level</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredParts.length === 0 && <TableRow><TableCell colSpan={7} className="py-6"><EmptyState icon={IconPackage}>No parts found.</EmptyState></TableCell></TableRow>}
            {filteredParts.map((part) => {
              const isLow = part.stockQuantity <= part.minStockLevel;

              return (
                <TableRow key={part.id}>
                  <TableCell>
                    <span className={`font-bold block ${part.inactive ? 'text-muted-foreground' : ''}`}>{part.name}{part.inactive && <Badge variant="secondary" className="ml-2 text-[10px] uppercase">Inactive</Badge>}</span>
                    <span className="tabular-nums text-[11px] text-muted-foreground block">{part.sku}</span>
                  </TableCell>

                  <TableCell>{part.category}</TableCell>

                  <TableCell className="text-muted-foreground tabular-nums text-[11px]">{part.location}</TableCell>

                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatGBP(part.unitCost)}</TableCell>

                  <TableCell className="text-right tabular-nums font-semibold">{formatGBP(part.sellingPrice)}</TableCell>

                  <TableCell className="text-right">
                    <span className={`tabular-nums font-semibold ${isLow ? 'text-rose-600' : ''}`}>
                      {part.stockQuantity}
                    </span>
                    {isLow && (
                      <span className="text-[10px] text-rose-700 font-semibold block">
                        Low (Min {part.minStockLevel})
                      </span>
                    )}
                  </TableCell>

                  <TableCell>
                    <RowActions subject={part.name} actions={[
                      { icon: IconAdjustments, label: 'Adjust stock', onClick: () => { setAdjustingPart(part); setAdjustDelta(''); setAdjustType('restock_purchase'); setShowAdjustModal(true); } },
                      { icon: part.inactive ? IconCheck : IconCancel, label: part.inactive ? 'Activate' : 'Deactivate', destructive: !part.inactive, onClick: () => void updatePart(part.id, { inactive: !part.inactive }) },
                      { icon: IconTrash, label: 'Delete', destructive: true, onClick: () => confirmToast(`Delete ${part.name}? Its stock history is kept.`, () => void deletePart(part.id)) },
                    ]} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableCard></div>

      {/* Movement History Log */}
      <Card className="gap-3 py-4 px-4">
        <h3 className="font-bold text-sm">Recent Inventory Movement Log</h3>
        <div className="divide-y divide-border overflow-x-auto text-xs">
          {inventoryMovements.length === 0 && <EmptyState icon={IconArrowsExchange} compact>No stock movements yet.</EmptyState>}
          {paged.rows.map((mov) => {
            const part = parts.find((p) => p.id === mov.partId);
            return (
              <div key={mov.id} className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <span className="font-semibold">{part?.name || 'Part'}</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{mov.notes}</p>
                </div>
                <div className="text-right whitespace-nowrap">
                  <span className={`tabular-nums font-semibold ${mov.quantityDelta > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {mov.quantityDelta > 0 ? `+${mov.quantityDelta}` : mov.quantityDelta}
                  </span>
                  <span className="text-[10px] text-muted-foreground block tabular-nums">
                    {formatDateUK(mov.timestamp)} by {mov.userName}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {paged.pager}
      </Card>


      {showAdjustModal && adjustingPart && (
        <FormDialog onClose={() => setShowAdjustModal(false)} onSubmit={handleSaveAdjustment} busy={busy} submitLabel={busy ? 'Saving…' : 'Confirm Adjustment'} title={<>Adjust Stock - {adjustingPart.name}</>} description={<>Current Level: <strong className="tabular-nums">{adjustingPart.stockQuantity}</strong></>}>
              <div className="space-y-1.5">
                <Label htmlFor="adj-type" className="text-xs">Adjustment Type</Label>
                <Select value={adjustType} onValueChange={(v) => setAdjustType(v as typeof adjustType)}>
                  <SelectTrigger id="adj-type" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restock_purchase">Restock Purchase (+ Add)</SelectItem>
                    <SelectItem value="stock_adjustment">Stock Write-Off / Audit (- Deduct)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adj-qty" className="text-xs">Quantity</Label>
                <Input
                  type="number" min="1" required
                  id="adj-qty" name="quantity" inputMode="numeric" max={adjustType === 'stock_adjustment' ? adjustingPart.stockQuantity : undefined} value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  className="tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adj-notes" className="text-xs">Reason / Supplier Note</Label>
                <Input
                  type="text" required
                  id="adj-notes" name="notes" autoComplete="off" placeholder="e.g. supplier or reason for write-off…" value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                />
              </div>

              </FormDialog>
      )}


      {showAddPartModal && (
        <DetailDrawer onClose={() => setShowAddPartModal(false)} title={<>Add Catalogue Item</>} description={<>Enter the new catalogue item details</>}
          footer={<>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddPartModal(false)}>Cancel</Button>
              <Button type="submit" form="part-form" size="sm" disabled={busy}>{busy ? 'Adding…' : 'Add Part'}</Button>
          </>}>
          <form id="part-form" onSubmit={handleSavePart} className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="p-name" className="text-xs">Part / Item Name *</Label>
              <Input type="text" required id="p-name" name="name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Condensate Drain Neutraliser Kit" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-sku" className="text-xs">SKU Code *</Label>
                <Input type="text" required id="p-sku" name="sku" autoComplete="off" spellCheck={false} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. CDN-022" className="tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-cat" className="text-xs">Category</Label>
                <Input type="text" id="p-cat" name="category" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-cost" className="text-xs">Unit Cost (£) *</Label>
                <Input type="number" step="0.01" required id="p-cost" name="unitCost" min="0" inputMode="decimal" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-price" className="text-xs">Selling Price (£) *</Label>
                <Input type="number" step="0.01" required id="p-price" name="sellingPrice" min="0" inputMode="decimal" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} className="tabular-nums" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-stock" className="text-xs">Initial Stock Qty</Label>
                <Input type="number" required id="p-stock" name="stock" min="0" inputMode="numeric" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} className="tabular-nums" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-min" className="text-xs">Min Reorder Level</Label>
                <Input type="number" required id="p-min" name="minStock" min="0" inputMode="numeric" value={minStockLevel} onChange={(e) => setMinStockLevel(e.target.value)} className="tabular-nums" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-loc" className="text-xs">Storage Location</Label>
              <Input type="text" id="p-loc" name="location" autoComplete="off" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Warehouse Bin C4 / Van 1…" />
            </div>

            </form>
        </DetailDrawer>
      )}

    </div>
  );
};
