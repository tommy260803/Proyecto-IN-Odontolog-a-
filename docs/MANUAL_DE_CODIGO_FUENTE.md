# MANUAL DE CÓDIGO FUENTE

## NexoSalud

**Sistema de gestión e inteligencia de negocios para la etapa BUYER**  
**Versión:** 0.0.0

## INTEGRANTES

| N.° | Integrante |
|---:|---|
| 1 | [Nombre del integrante] |
| 2 | [Nombre del integrante] |
| 3 | [Nombre del integrante] |

## CONTENIDO GENERAL

### Contenido

- [A) PANTALLA PÚBLICA, LOGIN Y REGISTRO](#a-pantalla-pública-login-y-registro)
  1. [Portal público y acceso del personal](#1-portal-público-y-acceso-del-personal)
  2. [Registro público de solicitud BUYER](#2-registro-público-de-solicitud-buyer)
- [B) ETAPA BUYER](#b-etapa-buyer)
  1. [Prospectos de Admisión (BUYER)](#1-prospectos-de-admisión-buyer)
  2. [Registrar Nuevo Prospecto (BUYER)](#2-registrar-nuevo-prospecto-buyer)
  3. [Ficha de Prospecto](#3-ficha-de-prospecto)
  4. [Actividades del Agente Buyer](#4-actividades-del-agente-buyer)
  5. [Indicadores de la etapa BUYER](#5-indicadores-de-la-etapa-buyer)

---

## A) PANTALLA PÚBLICA, LOGIN Y REGISTRO

### 1. Portal público y acceso del personal

**Figura 1**  
*Pantalla del Portal público y acceso del personal*

![Figura 1 - Pantalla del Portal público y acceso del personal](./capturas/01-portal-acceso-personal.png)

**Frontend**

📄 `frontend/src/modules/buyer/pages/BuyerRequestInfoPage.tsx`

```tsx
export default function BuyerRequestInfoPage() {
  const navigate = useNavigate();
  const [isStaffLoginOpen, setIsStaffLoginOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f7faf9] text-slate-900">
      <LandingNavbar
        onRequestInfo={() => document.getElementById('buyer-intake')?.scrollIntoView({ behavior: 'smooth' })}
        onStaffLogin={() => setIsStaffLoginOpen(true)}
      />
      {/* ... */}
      <BuyerIntakeForm />
      <StaffLoginModal
        open={isStaffLoginOpen}
        onOpenChange={setIsStaffLoginOpen}
        onAuthenticated={(destination) => navigate(destination)}
      />
    </div>
  );
}
```

📄 `frontend/src/modules/buyer/components/landing/StaffLoginModal.tsx`

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  setIsLoading(true);
  try {
    const result = await staffAuthService.login({ email, password });
    if (result.success) {
      onAuthenticated(destination);
      onOpenChange(false);
    } else {
      setError(result.error || 'Credenciales inválidas');
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
  } finally {
    setIsLoading(false);
  }
};
```

📄 `frontend/src/app/router/index.tsx`

```tsx
<Route path="/" element={<BuyerRequestInfoPage />} />
<Route path="/solicitar-informacion" element={<Navigate to="/" replace />} />
<Route path="/buyer" element={<BuyerPage />} />
<Route path="/buyer/nuevo" element={<NewBuyerPage />} />
<Route path="/buyer/:id" element={<BuyerDetailPage />} />
```

**Descripción:** se muestra el código para el portal público y el botón **Personal**. `BuyerRequestInfoPage` monta el formulario público y el modal de autenticación; `StaffLoginModal` valida las credenciales mediante `staffAuthService` y redirige al destino interno seleccionado.

### 2. Registro público de solicitud BUYER

**Figura 2**  
*Formulario público de solicitud BUYER*

![Figura 2 - Formulario público de solicitud BUYER](./capturas/02-registro-publico-buyer.png)

**Frontend**

📄 `frontend/src/modules/buyer/components/landing/BuyerIntakeForm.tsx`

```tsx
const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault();
  if (!validateStep(step)) return;

  setIsSubmitting(true);
  try {
    const result = await buyerService.registerOpportunity({
      nombres: form.firstName,
      apellidos: form.lastName,
      email: form.email,
      numero: form.phone,
      mensaje: form.message,
      id_servicio: form.serviceId ? Number(form.serviceId) : undefined,
      sede_preferida: form.preferredLocation,
      autoriza_contacto: form.contactAuthorization,
    });
    setResult(result);
  } catch (error) {
    setSubmitError(error instanceof Error ? error.message : 'No se pudo registrar la solicitud');
  } finally {
    setIsSubmitting(false);
  }
};
```

📄 `frontend/src/modules/buyer/services/buyer.service.ts`

```ts
registerOpportunity: async (data: any) => {
  if (!useApi) return buyerUseCases.registerOpportunity(data);
  const res = await fetch(`${API_URL}/buyer/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al registrar la solicitud');
  }
  return res.json();
},
```

**Backend**

📄 `backend/src/routes/buyer.routes.ts`

```ts
router.post('/register', async (req, res) => {
  const {
    nombres,
    apellidos,
    email,
    numero,
    autoriza_contacto,
    id_servicio,
    id_interaccion_previa,
  } = req.body;

  try {
    let etapaBuyer = await prisma.etapas.findFirst({ where: { nombre: 'BUYER' } });
    if (!etapaBuyer) {
      etapaBuyer = await prisma.etapas.create({
        data: { nombre: 'BUYER', descripcion: 'Contacto inicial' },
      });
    }
    // ...
  } catch (error) {
    // ...
  }
});
```

**Descripción:** se muestra el código para el envío del formulario público. El componente valida los pasos y envía la solicitud a `POST /api/buyer/register`; el backend obtiene o crea la etapa BUYER y procesa la identificación, contacto, motivo y autorización.

## B) ETAPA BUYER

### 1. Prospectos de Admisión (BUYER)

**Figura 3**  
*Pantalla de Prospectos de Admisión (BUYER)*

![Figura 3 - Pantalla de Prospectos de Admisión (BUYER)](./capturas/03-listado-buyer.png)

**Figura 4**  
*Indicadores de la etapa BUYER*

![Figura 4 - Indicadores de la etapa BUYER](./capturas/04-indicadores-buyer.png)

**Frontend**

📄 `frontend/src/modules/buyer/pages/BuyerPage.tsx`

```tsx
export default function BuyerPage() {
  return <BuyerListView />;
}
```

📄 `frontend/src/modules/buyer/components/BuyerListView.tsx`

```tsx
const [searchTerm, setSearchTerm] = useState('');
const [selectedStates, setSelectedStates] = useState<string[]>([]);
const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
const [startDate, setStartDate] = useState('');
const [endDate, setEndDate] = useState('');
const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(25);

const { data: buyerPage, isLoading, isError } = useBuyerPage({
  page: currentPage,
  pageSize,
  search: searchTerm,
  states: selectedStates,
  channels: selectedChannels,
  fromDate: startDate,
  toDate: endDate,
});
const buyers = buyerPage?.items || [];
const totalRecords = buyerPage?.pagination.total || 0;
```

📄 `frontend/src/modules/buyer/hooks/useBuyerQueries.ts`

```ts
export function useBuyerPage(params: {
  page: number;
  pageSize: number;
  search?: string;
  states?: string[];
  channels?: string[];
  fromDate?: string;
  toDate?: string;
}) {
  return useQuery({
    queryKey: [QUERY_KEYS.BUYERS, 'page', params],
    queryFn: () => buyerService.getBuyersPage(params),
    placeholderData: (previous) => previous,
  });
}
```

📄 `frontend/src/modules/buyer/services/buyer.service.ts`

```ts
const res = await fetch(`${API_URL}/buyer?${query.toString()}`);
if (!res.ok) throw new Error('Error al cargar buyers');
return res.json();
```

**Backend**

📄 `backend/src/routes/buyer.routes.ts`

```ts
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1,
      Number.parseInt(String(req.query.pageSize || '25'), 10) || 25));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const selectedStates = typeof req.query.states === 'string'
      ? req.query.states.split(',').map((value) => value.trim()).filter(Boolean)
      : [];
    // ...
    const queryOptions: any = {
      where,
      orderBy: { fecha_registro: 'desc' },
      include: { Etapa: true, CanalOrigen: true, Interacciones: { take: 20 } },
    };
    // ...
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener buyers' });
  }
});
```

**Descripción:** se muestra el código para listar, buscar, filtrar y paginar prospectos. `BuyerListView` conserva los filtros y consume `useBuyerPage`; el endpoint GET `/api/buyer` limita el tamaño de página, aplica los filtros y devuelve los registros junto con la paginación y los indicadores.

### 2. Registrar Nuevo Prospecto (BUYER)

**Figura 5**  
*Pantalla de Registrar Nuevo Prospecto (BUYER)*

![Figura 5 - Pantalla de Registrar Nuevo Prospecto (BUYER)](./capturas/05-nuevo-buyer.png)

**Figura 6**  
*Validación de autorización y duplicidad del registro BUYER*

![Figura 6 - Validación de autorización y duplicidad del registro BUYER](./capturas/06-validacion-nuevo-buyer.png)

**Frontend**

📄 `frontend/src/modules/buyer/pages/NewBuyerPage.tsx`

```tsx
export default function NewBuyerPage() {
  return <BuyerCreateView />;
}
```

📄 `frontend/src/modules/buyer/components/BuyerCreateView.tsx`

```tsx
const createBuyer = useCreateBuyer();

const handleSubmit = (data: BuyerFormValues) => {
  createBuyer.mutate(data, {
    onSuccess: () => {
      toast({ title: 'Prospecto registrado correctamente' });
      navigate('/buyer');
    },
    onError: (error) => {
      toast({
        title: 'No se pudo registrar el prospecto',
        description: error instanceof Error ? error.message : 'Error inesperado',
        variant: 'destructive',
      });
    },
  });
};
```

📄 `frontend/src/modules/buyer/components/BuyerForm.tsx`

```tsx
export const BuyerForm = forwardRef<BuyerFormRef, BuyerFormProps>(({
  initialValues,
  onSubmit,
  isLoading,
  isEdit,
  formId = 'buyer-form',
}, ref) => {
  const form = useForm<BuyerFormValues>({
    resolver: zodResolver(buyerSchema),
    defaultValues: initialValues,
  });
  // ...
});
```

📄 `frontend/src/modules/buyer/schemas/buyerSchema.ts`

```ts
export const buyerSchema = z.object({
  firstName: z.string().min(2, 'El nombre es obligatorio (mínimo 2 caracteres)'),
  lastName: z.string().min(2, 'El apellido es obligatorio (mínimo 2 caracteres)'),
  phone: z
    .string()
    .min(1, 'El número de teléfono / WhatsApp es obligatorio')
    .regex(/^[0-9]{9}$|^(\+?51)?[0-9]{9}$/, 'Debe ingresar un número de 9 dígitos válido (Perú)'),
  concreteRequest: z.string().min(3, 'Indica el motivo de consulta o necesidad'),
  contactAuthorization: z.boolean().refine((val) => val === true, {
    message: 'Debes aceptar la autorización de contacto y protección de datos',
  }),
});
```

📄 `frontend/src/modules/buyer/services/buyer.service.ts`

```ts
createBuyer: async (data: any) => {
  if (!useApi) return buyerUseCases.createBuyer(data);
  const res = await fetch(`${API_URL}/buyer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al crear buyer');
  }
  return res.json();
},
```

**Backend**

📄 `backend/src/routes/buyer.routes.ts`

```ts
router.post('/', async (req, res) => {
  const { 
    firstName, lastName, email, phone, documentNumber, channel,
    attractionSource, serviceOfInterestId, contactAuthorization,
    concreteRequest, pref_id_horario, pref_sede_preferida
  } = req.body;
  try {
    let resolvedFirstName = (firstName || req.body.nombres || req.body.fullName || req.body.name || '').trim();
    let resolvedLastName = (lastName || req.body.apellidos || '').trim();
    // ...
    const authContact = contactAuthorization !== undefined 
      ? Boolean(contactAuthorization) 
      : (req.body.autoriza_contacto !== undefined ? Boolean(req.body.autoriza_contacto) : false);
    // ...
  } catch (error) {
    console.error('Error al crear BUYER:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
```

**Descripción:** se muestra el código para el formulario interno de alta. `BuyerForm` usa `react-hook-form` y `buyerSchema`; `useCreateBuyer` llama a `POST /api/buyer`, donde se validan los datos y se persisten la persona, la captación y el contexto inicial.

### 3. Ficha de Prospecto

**Figura 7**  
*Pantalla de Ficha de Prospecto*

![Figura 7 - Pantalla de Ficha de Prospecto](./capturas/07-ficha-buyer.png)

**Figura 8**  
*Edición de datos de la Ficha de Prospecto*

![Figura 8 - Edición de datos de la Ficha de Prospecto](./capturas/08-edicion-ficha-buyer.png)

**Frontend**

📄 `frontend/src/modules/buyer/pages/BuyerDetailPage.tsx`

```tsx
export default function BuyerDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <BuyerDetailView buyerId={id || ''} />;
}
```

📄 `frontend/src/modules/buyer/components/BuyerDetailView.tsx`

```tsx
const { data: buyer, isLoading } = useBuyer(buyerId);
const updateBuyer = useUpdateBuyer();
const evaluateBuyer = useEvaluateBuyer();
const convertBuyer = useConvertBuyerToLead();

const handleRefreshAI = () => {
  if (!buyer || evaluateBuyer.isPending || isRetrying) return;
  evaluateBuyer.mutate(
    { id: buyerId, message: buyer.concreteRequest },
    {
      onSuccess: () => {
        toast({ title: 'Evaluación Gemini actualizada' });
      },
      onError: (err: any) => {
        toast({
          title: 'Error al evaluar',
          description: err?.message || 'Error al conectar con el evaluador Gemini',
          variant: 'destructive',
        });
      },
    }
  );
};
```

**Backend**

📄 `backend/src/routes/buyer.routes.ts`

```ts
router.put('/:id', async (req, res) => {
  try {
    const result = await writeBuyer(async (tx) => {
      // Actualiza datos de persona y conserva el historial de interacciones.
      // Actualiza preferencias sin sobrescribir la captación inicial.
      // ...
      return result;
    });
    return res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar BUYER' });
  }
});
```

📄 `backend/prisma/schema.prisma`

```prisma
model Personas {
  id_persona          Int      @id @default(autoincrement())
  nombres             String   @db.VarChar(50)
  apellidos           String   @db.VarChar(50)
  email               String?  @db.VarChar(100)
  numero              String?  @db.VarChar(20)
  autoriza_contacto   Boolean  @default(false)
  estado_calidad      String   @default("Valido") @db.VarChar(20)
  id_etapa_actual     Int
  fecha_registro      DateTime @default(now()) @db.DateTime2
  fecha_actualizacion DateTime? @db.DateTime2
  Etapa               Etapas   @relation(fields: [id_etapa_actual], references: [id_etapa])
  Preferencias        PersonaPreferencias[]
  Interacciones       Interacciones[]
  DecisionesIA        DecisionesIA[]
}
```

**Descripción:** se muestra el código para consultar y actualizar la ficha del prospecto. `BuyerDetailView` coordina la carga, edición y evaluación; el endpoint PUT conserva el historial de interacciones y actualiza las preferencias recibidas.

### 4. Actividades del Agente Buyer

**Figura 9**  
*Actividades del Agente Buyer con evaluación completada*

![Figura 9 - Actividades del Agente Buyer con evaluación completada](./capturas/09-actividades-agente-buyer.png)

**Figura 10**  
*Evaluación Buyer pendiente o desactualizada*

![Figura 10 - Evaluación Buyer pendiente o desactualizada](./capturas/10-evaluacion-buyer-pendiente.png)

**Frontend**

📄 `frontend/src/modules/buyer/components/BuyerDetailView.tsx`

```tsx
<div className="space-y-2.5">
  {/* Actividad 1: Perfilamiento inteligente de la necesidad */}
  <div className="border-l-2 border-[#0f766e] bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-r-lg border-y border-r border-slate-200/70 dark:border-slate-800">
    <span className="font-semibold text-slate-800 dark:text-slate-200">
      1. Perfilamiento de Necesidad Clínica
    </span>
    <dt className="text-slate-400">Servicio:</dt>
    <dd className="font-medium text-slate-700 dark:text-slate-200">
      {buyer.serviceOfInterest || 'No especificado'}
    </dd>
    {/* ... */}
  </div>
  {/* Actividad 2: Clasificación de intención y preparación para LEAD */}
  <div className="border-l-2 border-sky-500 bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-r-lg border-y border-r border-slate-200/70 dark:border-slate-800">
    <span className="font-semibold text-slate-800 dark:text-slate-200">
      2. Clasificación de Intención y Preparación para LEAD
    </span>
    {/* ... */}
  </div>
  {/* Actividad 3: Recomendación y siguiente acción */}
  <div className="border-l-2 border-emerald-500 bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-r-lg border-y border-r border-slate-200/70 dark:border-slate-800">
    <span className="font-semibold text-slate-800 dark:text-slate-200">
      3. Recomendación del Agente Buyer
    </span>
    {/* ... */}
  </div>
</div>
```

📄 `frontend/src/modules/buyer/hooks/useBuyerQueries.ts`

```ts
export function useEvaluateBuyer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message?: string }) =>
      buyerService.evaluateBuyer(id, { message }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS, variables.id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
    },
  });
}
```

**Backend**

📄 `backend/src/routes/buyer.routes.ts`

```ts
router.post('/:id/evaluate', async (req, res) => {
  const numId = Number(req.params.id);
  // ...
  const outcome = await BuyerEvaluationService.evaluateBuyerInteraction({
    id_persona: numId,
    id_captacion: captacionId,
    id_interaccion: targetInteractionId,
    mensaje: messageToEvaluate,
    id_servicio_declarado: declaredServiceId,
    pref_id_horario: prefHorario,
    sede_preferida: vigentePref?.sede_preferida || null,
  });

  return res.json({
    success: true,
    data: outcome,
    latestEvaluation: {
      id_decision: outcome.id_decision || null,
      id_interaccion: outcome.id_interaccion,
    },
  });
});
```

📄 `backend/src/services/buyerEvaluationService.ts`

```ts
export class BuyerEvaluationService {
  private static inFlightEvaluations = new Map<number, Promise<BuyerEvaluationOutcome>>();

  public static async evaluateBuyerInteraction(
    input: EvaluateBuyerInteractionInput
  ): Promise<BuyerEvaluationOutcome> {
    const { id_interaccion } = input;
    const existingPromise = this.inFlightEvaluations.get(id_interaccion);
    if (existingPromise) return existingPromise;

    const evaluationPromise = this.executeEvaluationCore(input).finally(() => {
      this.inFlightEvaluations.delete(id_interaccion);
    });
    this.inFlightEvaluations.set(id_interaccion, evaluationPromise);
    return evaluationPromise;
  }
}
```

**Descripción:** se muestra el código para las tres actividades y la acción **Actualizar**. La vista organiza el perfilamiento, la intención y la recomendación; el endpoint `POST /api/buyer/:id/evaluate` envía el mensaje vigente al servicio de evaluación y persiste el resultado.

### 5. Indicadores de la etapa BUYER

**Figura 11**  
*Detalle de la división de los indicadores BUYER*

![Figura 11 - Detalle de la división de los indicadores BUYER](./capturas/11-formulas-indicadores-buyer.png)

**Frontend**

📄 `frontend/src/modules/buyer/components/BuyerListView.tsx`

```tsx
const kpiMetrics = useMemo(() => {
  const indicators = buyerPage?.indicators;
  const percentage = (value: number | null) =>
    value === null ? 'N/D' : `${value.toFixed(1)}%`;

  return [
    {
      id: 'kpi-b1',
      label: 'B1 · Conversión a LEAD en 14 días',
      value: percentage(indicators?.b1.rate ?? null),
      detail: indicators
        ? `${indicators.b1.numerator.toLocaleString('es-PE')} conversiones / ${indicators.b1.denominator.toLocaleString('es-PE')} Buyers utilizables`
        : 'Cargando indicadores...',
    },
    {
      id: 'kpi-b2',
      label: 'B2 · Contactos utilizables',
      value: percentage(indicators?.b2.rate ?? null),
      detail: indicators
        ? `${indicators.b2.numerator.toLocaleString('es-PE')} utilizables / ${indicators.b2.denominator.toLocaleString('es-PE')} registrados`
        : 'Cargando indicadores...',
    },
    {
      id: 'kpi-b3',
      label: 'B3 · Tiempo promedio de conversión',
      value: indicators?.b3.averageDays == null
        ? 'N/D'
        : `${indicators.b3.averageDays.toFixed(1)} días`,
      detail: indicators
        ? `${indicators.b3.totalDays.toLocaleString('es-PE')} días acumulados / ${indicators.b3.conversions.toLocaleString('es-PE')} conversiones`
        : 'Cargando indicadores...',
    },
  ];
}, [buyerPage?.indicators]);
```

**Backend**

📄 `backend/src/routes/buyer.routes.ts`

```ts
const usableIndicatorPersons = indicatorPersons.filter((person) => {
  const hasName = Boolean(person.nombres?.trim() && person.apellidos?.trim());
  const hasContact = Boolean(person.numero?.trim() || person.email?.trim());
  const isDuplicate = duplicateBuyerIds.has(person.id_persona) ||
    person.estado_calidad === 'Duplicado';
  return hasName && hasContact && person.autoriza_contacto === true &&
    !isDuplicate && person.estado_calidad !== 'Rechazado';
});

const convertedWithin14Days = usableIndicatorPersons.filter((person) => {
  const conversionDate = ['LEAD', 'PAYER', 'CUSTOMER', 'TURNED']
    .includes(person.Etapa?.nombre || '') ? person.fecha_actualizacion : null;
  if (!conversionDate) return false;
  const days = (conversionDate.getTime() - person.fecha_registro.getTime()) / 86400000;
  return days >= 0 && days <= 14;
}).length;

const averageConversionDays = conversionDays.length > 0
  ? conversionDays.reduce((sum, days) => sum + days, 0) / conversionDays.length
  : null;
```

📄 `docs/agentes/Indicadores de Buyer en NexoSalud.md`

```md
### B1 · Conversión a LEAD en 14 días

Conversión en 14 días (%) =
(Buyers utilizables convertidos dentro de 14 días /
 Buyers utilizables) × 100

### B2 · Contactos utilizables

Contactos utilizables (%) =
(Contactos utilizables / Contactos registrados) × 100

### B3 · Tiempo promedio de conversión

Tiempo promedio =
Días acumulados entre registro y conversión /
Conversiones con fecha válida
```

**Descripción:** se muestra el código para calcular y presentar B1, B2 y B3. El backend determina los numeradores y denominadores sobre los registros válidos, el frontend muestra la división y usa `N/D` cuando no existe información suficiente.

