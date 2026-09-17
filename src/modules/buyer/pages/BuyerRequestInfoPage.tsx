import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { buyerService } from '../services/buyer.service';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/shared/hooks/use-toast';

export default function BuyerRequestInfoPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [catalogs, setCatalogs] = useState<any>({ canales: [], fuentes: [], servicios: [], sedes: [] });
  const [formData, setFormData] = useState({
    nombres: '',
    apellidos: '',
    email: '',
    numero: '',
    autoriza_contacto: false,
    id_canal: '',
    id_fuente: '',
    id_servicio: '',
    sede_preferida: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    buyerService.getCatalogs().then(setCatalogs).catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await buyerService.registerAndConvert({
        ...formData,
        id_canal: Number(formData.id_canal),
        id_fuente: Number(formData.id_fuente),
        id_servicio: Number(formData.id_servicio),
      });
      toast({ title: 'Solicitud Registrada', description: result.message || 'Tu solicitud ha sido enviada exitosamente.' });
      navigate('/');
    } catch (error) {
      toast({ title: 'Error', description: 'Hubo un error al enviar la solicitud.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-lg border-t-4 border-t-blue-600">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-slate-800">Solicitar Información</CardTitle>
          <CardDescription>
            Déjanos tus datos para ponernos en contacto contigo y brindarte toda la información que necesitas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombres">Nombres</Label>
                <Input id="nombres" name="nombres" required placeholder="Tus nombres" value={formData.nombres} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apellidos">Apellidos</Label>
                <Input id="apellidos" name="apellidos" required placeholder="Tus apellidos" value={formData.apellidos} onChange={handleChange} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input id="email" type="email" name="email" required placeholder="tu@email.com" value={formData.email} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numero">Número de Teléfono</Label>
                <Input id="numero" name="numero" required placeholder="999888777" value={formData.numero} onChange={handleChange} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Servicio de Interés</Label>
                <Select onValueChange={(val) => handleSelectChange('id_servicio', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un servicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogs.servicios.map((s: any) => (
                      <SelectItem key={s.id_servicio} value={s.id_servicio.toString()}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sede de Preferencia</Label>
                <Select onValueChange={(val) => handleSelectChange('sede_preferida', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una sede" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogs.sedes.map((s: any) => (
                      <SelectItem key={s.id_sede} value={s.nombre}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Datos Ocultos / Administrativos usualmente, pero aquí los simulamos para el caso práctico */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-100 p-4 rounded-md">
              <div className="space-y-2">
                <Label className="text-xs text-slate-500 uppercase tracking-wider">Canal de Origen</Label>
                <Select onValueChange={(val) => handleSelectChange('id_canal', val)}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="¿Cómo nos contactaste?" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogs.canales.map((c: any) => (
                      <SelectItem key={c.id_canal} value={c.id_canal.toString()}>{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-500 uppercase tracking-wider">Fuente de Atracción</Label>
                <Select onValueChange={(val) => handleSelectChange('id_fuente', val)}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="¿Dónde nos viste?" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogs.fuentes.map((f: any) => (
                      <SelectItem key={f.id_fuente} value={f.id_fuente.toString()}>{f.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input 
                type="checkbox" 
                id="autoriza_contacto" 
                name="autoriza_contacto" 
                checked={formData.autoriza_contacto} 
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <Label htmlFor="autoriza_contacto" className="text-sm font-normal text-slate-600">
                Autorizo el uso de mis datos para ser contactado según la política de privacidad.
              </Label>
            </div>
            
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 mt-4" disabled={loading}>
              {loading ? 'Procesando...' : 'Enviar Solicitud y Recibir Información'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
