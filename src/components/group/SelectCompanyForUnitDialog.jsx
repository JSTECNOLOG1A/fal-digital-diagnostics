import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin } from 'lucide-react';

/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onOpenChange
 * @param {any=} props.companies
 * @param {any=} props.onSelect
 */
export default function SelectCompanyForUnitDialog({ open, onOpenChange, companies, onSelect }) {
  const [selectedId, setSelectedId] = useState(companies[0]?.id || '');

  const handleConfirm = () => {
    if (selectedId) {
      onSelect(selectedId);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-500" />
            Nova Unidade — Selecionar Empresa
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <Label>Em qual empresa será criada a unidade?</Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione a empresa" />
            </SelectTrigger>
            <SelectContent>
              {companies.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedId}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}