import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';
import { groupKey } from '@/lib/query-client';

/**
 * @param {Object} props
 * @param {any=} props.open
 * @param {any=} props.onOpenChange
 * @param {any=} props.groupId
 * @param {any=} props.tenantId
 * @param {any=} props.companies
 * @param {any=} props.existingLink
 * @param {any=} props.onCreated
 */
export default function CreateOwnershipLinkDialog({
  open,
  onOpenChange,
  groupId,
  tenantId,
  companies = [],
  existingLink = null,
  onCreated,
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    investor_company_id: '',
    investor_person_name: '',
    invested_company_id: '',
    percentage: '',
    relationship_type: 'quotista',
    voting_percentage: '',
    economic_percentage: '',
    is_controller: false,
    notes: '',
  });

  const [errors, setErrors] = useState(/** @type {Record<string, any>} */ ({}));
  const [investorType, setInvestorType] = useState('company');

  // Buscar todos os vínculos para validação
  const { data: allLinks = [] } = useQuery({
    queryKey: groupKey(tenantId, groupId, 'ownership-links'),
    queryFn: () => base44.entities.CompanyOwnershipLink.filter({ group_id: groupId }),
    enabled: !!groupId,
  });

  // Pré-preencher se editando
  useEffect(() => {
    if (existingLink) {
      setFormData(existingLink);
      setInvestorType(existingLink.investor_company_id ? 'company' : 'person');
    } else {
      resetForm();
    }
  }, [existingLink, open]);

  const resetForm = () => {
    setFormData({
      investor_company_id: '',
      investor_person_name: '',
      invested_company_id: '',
      percentage: '',
      relationship_type: 'quotista',
      voting_percentage: '',
      economic_percentage: '',
      is_controller: false,
      notes: '',
    });
    setErrors({});
    setInvestorType('company');
  };

  // Validação
  const validate = () => {
    const newErrors = {};

    if (investorType === 'company' && !formData.investor_company_id) {
      newErrors.investor_company_id = 'Selecione a empresa investidora';
    }
    if (investorType === 'person' && !formData.investor_person_name?.trim()) {
      newErrors.investor_person_name = 'Digite o nome do investidor pessoa física';
    }
    if (!formData.invested_company_id) {
      newErrors.invested_company_id = 'Selecione a empresa investida';
    }
    if (!formData.percentage || parseFloat(formData.percentage) <= 0 || parseFloat(formData.percentage) > 100) {
      newErrors.percentage = 'Percentual deve estar entre 0 e 100';
    }

    // Validar soma de percentuais
    const investedId = formData.invested_company_id;
    if (investedId) {
      const otherLinks = allLinks.filter(
        l => l.invested_company_id === investedId && l.id !== existingLink?.id
      );
      const otherPercentage = otherLinks.reduce((sum, l) => sum + (l.percentage || 0), 0);
      const totalWithNew = otherPercentage + parseFloat(formData.percentage || 0);

      if (totalWithNew > 100) {
        newErrors.percentage = `Soma ultrapassaria 100% (atual: ${otherPercentage.toFixed(2)}% + seu ${formData.percentage || 0}%)`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Mutation para criar
  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenantId,
        group_id: groupId,
        investor_company_id: investorType === 'company' ? formData.investor_company_id : null,
        investor_person_name: investorType === 'person' ? formData.investor_person_name : null,
        invested_company_id: formData.invested_company_id,
        percentage: parseFloat(formData.percentage),
        relationship_type: formData.relationship_type,
        voting_percentage: formData.voting_percentage ? parseFloat(formData.voting_percentage) : null,
        economic_percentage: formData.economic_percentage ? parseFloat(formData.economic_percentage) : null,
        is_controller: formData.is_controller,
        notes: formData.notes || null,
      };

      if (existingLink?.id) {
        return base44.entities.CompanyOwnershipLink.update(existingLink.id, payload);
      } else {
        return base44.entities.CompanyOwnershipLink.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKey(tenantId, groupId, 'ownership-links') });
      onOpenChange(false);
      resetForm();
      onCreated?.();
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validate()) {
      createMutation.mutate();
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existingLink ? 'Editar Vínculo Societário' : 'Novo Vínculo Societário'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de investidor */}
          <div>
            <Label className="text-xs font-semibold mb-1.5 block">Investidor</Label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  setInvestorType('company');
                  handleChange('investor_person_name', '');
                }}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  investorType === 'company'
                    ? 'bg-blue-100 border-blue-300 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Empresa
              </button>
              <button
                type="button"
                onClick={() => {
                  setInvestorType('person');
                  handleChange('investor_company_id', '');
                }}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  investorType === 'person'
                    ? 'bg-blue-100 border-blue-300 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Pessoa Física
              </button>
            </div>

            {investorType === 'company' ? (
              <div>
                <Select value={formData.investor_company_id} onValueChange={(val) => handleChange('investor_company_id', val)}>
                  <SelectTrigger className={errors.investor_company_id ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.trade_name || c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.investor_company_id && (
                  <p className="text-xs text-red-600 mt-1">{errors.investor_company_id}</p>
                )}
              </div>
            ) : (
              <div>
                <Input
                  placeholder="Nome da pessoa física"
                  value={formData.investor_person_name}
                  onChange={(e) => handleChange('investor_person_name', e.target.value)}
                  className={errors.investor_person_name ? 'border-red-500' : ''}
                />
                {errors.investor_person_name && (
                  <p className="text-xs text-red-600 mt-1">{errors.investor_person_name}</p>
                )}
              </div>
            )}
          </div>

          {/* Empresa investida */}
          <div>
            <Label className="text-xs font-semibold mb-1.5 block">Empresa Investida</Label>
            <Select value={formData.invested_company_id} onValueChange={(val) => handleChange('invested_company_id', val)}>
              <SelectTrigger className={errors.invested_company_id ? 'border-red-500' : ''}>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.trade_name || c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.invested_company_id && (
              <p className="text-xs text-red-600 mt-1">{errors.invested_company_id}</p>
            )}
          </div>

          {/* Percentual */}
          <div>
            <Label className="text-xs font-semibold mb-1.5 block">Percentual (%)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="0.00"
              value={formData.percentage}
              onChange={(e) => handleChange('percentage', e.target.value)}
              className={errors.percentage ? 'border-red-500' : ''}
            />
            {errors.percentage && (
              <p className="text-xs text-red-600 mt-1 flex items-start gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                {errors.percentage}
              </p>
            )}
          </div>

          {/* Tipo de relacionamento */}
          <div>
            <Label className="text-xs font-semibold mb-1.5 block">Tipo de Relacionamento</Label>
            <Select value={formData.relationship_type} onValueChange={(val) => handleChange('relationship_type', val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quotista">Quotista</SelectItem>
                <SelectItem value="acionista">Acionista</SelectItem>
                <SelectItem value="controladora">Controladora</SelectItem>
                <SelectItem value="coligada">Coligada</SelectItem>
                <SelectItem value="investidor_pessoa_fisica">Investidor Pessoa Física</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Controlador */}
          <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
            <input
              type="checkbox"
              id="is_controller"
              checked={formData.is_controller}
              onChange={(e) => handleChange('is_controller', e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="is_controller" className="text-xs font-medium cursor-pointer text-green-700">
              Marca como controlador
            </Label>
          </div>

          {/* Campos opcionais */}
          <details className="text-xs">
            <summary className="font-semibold cursor-pointer text-slate-600 mb-2">Opções avançadas</summary>
            <div className="space-y-3 mt-2">
              <div>
                <Label className="text-xs font-semibold mb-1 block">% Direito de Voto (opcional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="0.00"
                  value={formData.voting_percentage || ''}
                  onChange={(e) => handleChange('voting_percentage', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">% Econômico (opcional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="0.00"
                  value={formData.economic_percentage || ''}
                  onChange={(e) => handleChange('economic_percentage', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Observações (opcional)</Label>
                <Input
                  placeholder="Adicione notas sobre este vínculo"
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                />
              </div>
            </div>
          </details>
        </form>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="text-white"
            style={{ background: 'var(--fal-green-700)' }}
          >
            {createMutation.isPending ? 'Salvando...' : existingLink ? 'Atualizar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}