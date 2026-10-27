import React, { useState, useEffect } from 'react';
import {
  Megaphone,
  Plus,
  DollarSign,
  Calendar,
  Layers,
  ArrowUpRight,
  Loader2,
  Receipt,
  FileText,
  Building2,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { buyerService } from '../../services/buyer.service';
import type { CampaignItem, BuyerCatalogs } from '../../types/buyer.types';

export const BuyerCampaignsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [catalogs, setCatalogs] = useState<BuyerCatalogs | null>(null);

  // Modal Crear Campaña
  const [newCampaignModalOpen, setNewCampaignModalOpen] = useState(false);
  const [cNombre, setCNombre] = useState('');
  const [cDescripcion, setCDescripcion] = useState('');
  const [cIdCanal, setCIdCanal] = useState<number | ''>('');
  const [cIdFuente, setCIdFuente] = useState<number | ''>('');
  const [cFechaInicio, setCFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  // Modal Registrar Gasto
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignItem | null>(null);
  const [expenseImporte, setExpenseImporte] = useState('');
  const [expenseFecha, setExpenseFecha] = useState(new Date().toISOString().split('T')[0]);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [addingExpense, setAddingExpense] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const [campRes, cats] = await Promise.all([
        buyerService.getCampaigns(),
        buyerService.getCatalogs(),
      ]);
      setCampaigns(campRes.data || []);
      setCatalogs(cats);
    } catch (e) {
      console.error('Error cargando campañas:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cNombre.trim()) return;

    setCreatingCampaign(true);
    try {
      await buyerService.createCampaign({
        nombre: cNombre.trim(),
        descripcion: cDescripcion.trim() || undefined,
        id_canal: cIdCanal ? Number(cIdCanal) : undefined,
        id_fuente: cIdFuente ? Number(cIdFuente) : undefined,
        fecha_inicio: cFechaInicio,
      });
      setNewCampaignModalOpen(false);
      setCNombre('');
      setCDescripcion('');
      await loadCampaigns();
    } catch (err: any) {
      alert(err.message || 'Error al crear campaña');
    } finally {
      setCreatingCampaign(false);
    }
  };

  const handleOpenAddExpense = (c: CampaignItem) => {
    setSelectedCampaign(c);
    setExpenseImporte('');
    setExpenseDesc('');
    setExpenseFecha(new Date().toISOString().split('T')[0]);
    setExpenseModalOpen(true);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign || !expenseImporte || Number(expenseImporte) <= 0) return;

    setAddingExpense(true);
    try {
      await buyerService.addCampaignExpense(selectedCampaign.id_campana, {
        importe: Number(expenseImporte),
        fecha: expenseFecha,
        descripcion: expenseDesc.trim() || 'Inversión publicitaria digital',
      });
      setExpenseModalOpen(false);
      await loadCampaigns();
    } catch (err: any) {
      alert(err.message || 'Error al registrar gasto');
    } finally {
      setAddingExpense(false);
    }
  };

  const totalInvertido = campaigns.reduce((acc, c) => acc + (c.totalGasto || 0), 0);
  const totalCaptados = campaigns.reduce((acc, c) => acc + (c.totalOportunidades || 0), 0);
  const cplPromedio = totalCaptados > 0 ? (totalInvertido / totalCaptados).toFixed(2) : '0.00';

  return (
    <div className="space-y-6">
      {/* Cabecera con acento formal Verde Esmeralda */}
      <div className="rounded-2xl border-l-4 border-emerald-600 border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
              <Megaphone className="h-5 w-5" />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Campañas de Marketing &amp; Registro de Inversión
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Trazabilidad de gastos publicitarios en <code className="bg-emerald-50 text-emerald-800 px-1 py-0.5 rounded font-mono text-[11px]">GastosCampana</code> para calcular el Costo por Lead real (B3).
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setNewCampaignModalOpen(true)}
          className="h-9 text-xs bg-emerald-700 text-white gap-1.5 hover:bg-emerald-800 rounded-xl shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Nueva Campaña
        </Button>
      </div>

      {/* Resumen Financiero con acento esmeralda */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Inversión Total Registrada</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-emerald-950 mt-2">
            S/ {totalInvertido.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-400 mt-1">Suma de pautas y comprobantes en base de datos</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Contactos Atribuidos</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">{totalCaptados}</div>
          <p className="text-xs text-slate-400 mt-1">Oportunidades originadas en campañas activas</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-800">CPL Preliminar Promedio</span>
            <div className="p-1.5 rounded-lg bg-sky-50 text-sky-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-sky-700 mt-2">
            S/ {cplPromedio}
          </div>
          <p className="text-xs text-slate-400 mt-1">Costo medio por prospecto captado en BUYER</p>
        </div>
      </div>

      {/* Lista de Campañas con cards estilizadas */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Campañas Comerciales Registradas ({campaigns.length})
          </h3>
          <span className="text-xs text-slate-500">Monitoreo publicitario activo</span>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-14 text-center text-xs text-slate-500">
            No hay campañas registradas. Haz clic en "Nueva Campaña" para crear la primera.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {campaigns.map((camp) => (
              <div key={camp.id_campana} className="p-5 hover:bg-emerald-50/20 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 max-w-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{camp.nombre}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          camp.activo ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {camp.activo ? 'ACTIVA' : 'INACTIVA'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                      {camp.descripcion || 'Sin descripción adicional'}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                      <span>Canal: <strong className="text-slate-700 font-semibold">{camp.canal}</strong></span>
                      <span>·</span>
                      <span>Fuente: <strong className="text-slate-700 font-semibold">{camp.fuente}</strong></span>
                      <span>·</span>
                      <span>Inicio: {new Date(camp.fecha_inicio).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Métricas financieras de la campaña */}
                  <div className="flex items-center gap-6 sm:text-right">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Gasto Total
                      </span>
                      <span className="font-mono text-sm font-bold text-slate-900">
                        S/ {Number(camp.totalGasto || 0).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {camp.gastos?.length || 0} recibos
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Contactos
                      </span>
                      <span className="font-mono text-sm font-bold text-slate-900">
                        {camp.totalOportunidades || 0}
                      </span>
                      <span className="text-[10px] text-slate-400 block">atribuidos</span>
                    </div>

                    <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                        CPL Estimado
                      </span>
                      <span className="font-mono text-sm font-bold text-emerald-900">
                        S/ {Number(camp.costoPorContacto || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="shrink-0 pl-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenAddExpense(camp)}
                        className="h-8 text-xs border-emerald-200 text-emerald-800 hover:bg-emerald-50 rounded-xl gap-1 font-semibold"
                      >
                        <Receipt className="h-3 w-3 text-emerald-600" />
                        + Gasto
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Crear Campaña */}
      <Dialog open={newCampaignModalOpen} onOpenChange={setNewCampaignModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900">
              Registrar Nueva Campaña Comercial
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Atribuye prospectos a una campaña y mide el costo por adquisición (CPL).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCampaign} className="space-y-3.5 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Nombre de la campaña *</Label>
              <Input
                type="text"
                placeholder="Ej. Meta Ads Ortodoncia Primavera 2026"
                value={cNombre}
                onChange={(e) => setCNombre(e.target.value)}
                required
                className="h-10 text-xs border-slate-200 rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Descripción / Objetivo</Label>
              <Input
                type="text"
                placeholder="Ej. Captación de pacientes para alineadores y brackets"
                value={cDescripcion}
                onChange={(e) => setCDescripcion(e.target.value)}
                className="h-10 text-xs border-slate-200 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Canal</Label>
                <select
                  value={cIdCanal}
                  onChange={(e) => setCIdCanal(e.target.value ? Number(e.target.value) : '')}
                  className="w-full h-10 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-800"
                >
                  <option value="">Seleccionar canal</option>
                  {catalogs?.canales.map((c) => (
                    <option key={c.id_canal} value={c.id_canal}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Fuente</Label>
                <select
                  value={cIdFuente}
                  onChange={(e) => setCIdFuente(e.target.value ? Number(e.target.value) : '')}
                  className="w-full h-10 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-800"
                >
                  <option value="">Seleccionar fuente</option>
                  {catalogs?.fuentes.map((f) => (
                    <option key={f.id_fuente} value={f.id_fuente}>
                      {f.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Fecha de Inicio</Label>
              <Input
                type="date"
                value={cFechaInicio}
                onChange={(e) => setCFechaInicio(e.target.value)}
                className="h-10 text-xs border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNewCampaignModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={creatingCampaign}
                className="text-xs bg-emerald-700 text-white hover:bg-emerald-800 rounded-xl"
              >
                {creatingCampaign ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Crear Campaña'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Registrar Gasto */}
      <Dialog open={expenseModalOpen} onOpenChange={setExpenseModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900">
              Registrar Gasto Publicitario (GastosCampana)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Campaña: {selectedCampaign?.nombre}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddExpense} className="space-y-3.5 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Importe en Soles (S/) *</Label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">S/</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={expenseImporte}
                  onChange={(e) => setExpenseImporte(e.target.value)}
                  required
                  className="pl-9 h-10 text-xs border-slate-200 font-mono rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Fecha del Desembolso</Label>
              <Input
                type="date"
                value={expenseFecha}
                onChange={(e) => setExpenseFecha(e.target.value)}
                className="h-10 text-xs border-slate-200 rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Concepto / Comprobante</Label>
              <Input
                type="text"
                placeholder="Ej. Factura Meta Ads abril pauta #291"
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
                className="h-10 text-xs border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExpenseModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={addingExpense}
                className="text-xs bg-emerald-700 text-white hover:bg-emerald-800 rounded-xl"
              >
                {addingExpense ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar Gasto'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
