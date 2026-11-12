-- Solo lectura. Parametros Prisma: buscar, estado, canal, desde ISO UTC o '', hasta ISO UTC o ''.
SET NOCOUNT ON;
IF @@SERVERNAME<>N'DANIELPC' OR DB_NAME()<>N'NexoSalud_LeadEnsayoFinal'
  THROW 54830,'Destino QA incorrecto',1;
DECLARE @buscar nvarchar(150)=@P1,@estado nvarchar(30)=@P2,@canal nvarchar(150)=@P3;
DECLARE @desde datetime2=TRY_CONVERT(datetime2,NULLIF(@P4,''),127),@hasta datetime2=TRY_CONVERT(datetime2,NULLIF(@P5,''),127);
;WITH Base AS (
 SELECT p.id_persona,p.nombres,p.apellidos,p.numero,p.email,p.dni,p.autoriza_contacto,
   p.estado_calidad,p.fecha_registro,p.id_campana_origen,p.id_canal_origen,
   et.nombre etapa,ca.nombre canal,cp.nombre campana,
   RIGHT(d.digitos,9) telefono_normalizado,LOWER(LTRIM(RTRIM(p.email))) email_normalizado,LTRIM(RTRIM(p.dni)) dni_normalizado,
   cap.fecha_captacion,ev.fecha_conversion
 FROM dbo.Personas p LEFT JOIN dbo.Etapas et ON et.id_etapa=p.id_etapa_actual
 LEFT JOIN dbo.Canales ca ON ca.id_canal=p.id_canal_origen
 LEFT JOIN dbo.Campanas cp ON cp.id_campana=p.id_campana_origen
 -- Se comprobo en QA que no hay telefonos con caracteres fuera de este conjunto.
 OUTER APPLY (SELECT REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
   COALESCE(p.numero,''),'+',''),' ',''),'-',''),'(',''),')',''),'.',''),'/','') digitos) d
 OUTER APPLY(SELECT MIN(fecha_captacion) fecha_captacion FROM dbo.CaptacionesBuyer c WHERE c.id_persona=p.id_persona) cap
 OUTER APPLY(SELECT MIN(e.fecha_hora) fecha_conversion FROM dbo.EventosEtapa e
   JOIN dbo.Etapas eo ON eo.id_etapa=e.etapa_origen JOIN dbo.Etapas ed ON ed.id_etapa=e.etapa_destino
   WHERE e.id_persona=p.id_persona AND eo.nombre='BUYER' AND ed.nombre='LEAD') ev
),
Duplicados AS (
 SELECT id_persona FROM (
  SELECT *,COUNT(*) OVER(PARTITION BY telefono_normalizado) cant_tel,
    COUNT(*) OVER(PARTITION BY dni_normalizado) cant_dni,COUNT(*) OVER(PARTITION BY email_normalizado) cant_email
  FROM Base WHERE etapa='BUYER'
 ) b WHERE estado_calidad='Duplicado' OR (LEN(telefono_normalizado)>=8 AND cant_tel>1)
   OR (NULLIF(dni_normalizado,'') IS NOT NULL AND cant_dni>1)
   OR (CHARINDEX('@',email_normalizado)>0 AND cant_email>1)
),
Universo AS (
 SELECT b.*,CASE WHEN d.id_persona IS NOT NULL OR b.estado_calidad='Duplicado' THEN 1 ELSE 0 END duplicado
 FROM Base b LEFT JOIN Duplicados d ON d.id_persona=b.id_persona
 WHERE (id_campana_origen IS NOT NULL OR id_canal_origen IS NOT NULL OR etapa IN('BUYER','LEAD','PAYER','CUSTOMER','TURNED'))
 AND (@buscar='' OR CHARINDEX(@buscar,nombres)>0 OR CHARINDEX(@buscar,apellidos)>0 OR CHARINDEX(@buscar,dni)>0
  OR CHARINDEX(@buscar,email)>0 OR CHARINDEX(@buscar,numero)>0 OR CHARINDEX(@buscar,canal)>0 OR CHARINDEX(@buscar,campana)>0
  OR EXISTS(SELECT 1 FROM dbo.Solicitudes s JOIN dbo.Servicios v ON v.id_servicio=s.id_servicio WHERE s.id_persona=b.id_persona AND CHARINDEX(@buscar,v.nombre)>0))
 AND (@canal='' OR canal=@canal)
),
Filtrado AS (
 SELECT *,CASE WHEN NULLIF(LTRIM(RTRIM(nombres)),'') IS NOT NULL AND NULLIF(LTRIM(RTRIM(apellidos)),'') IS NOT NULL
   AND (NULLIF(LTRIM(RTRIM(numero)),'') IS NOT NULL OR NULLIF(LTRIM(RTRIM(email)),'') IS NOT NULL)
   AND autoriza_contacto=1 AND estado_calidad='Valido' AND duplicado=0 THEN 1 ELSE 0 END utilizable,
   CASE WHEN (@desde IS NULL OR fecha_registro>=@desde) AND (@hasta IS NULL OR fecha_registro<=@hasta) THEN 1 ELSE 0 END registro_periodo,
   CASE WHEN fecha_captacion IS NOT NULL AND (@desde IS NULL OR fecha_captacion>=@desde) AND (@hasta IS NULL OR fecha_captacion<=@hasta) THEN 1 ELSE 0 END captacion_periodo,
   CASE WHEN etapa IN('LEAD','PAYER','CUSTOMER','TURNED') THEN 1 ELSE 0 END avanzado,
   DATEDIFF_BIG(millisecond,fecha_captacion,fecha_conversion)/86400000.0 dias_captacion,
   DATEDIFF_BIG(millisecond,fecha_registro,fecha_conversion)/86400000.0 dias_registro
 FROM Universo WHERE @estado='' OR (@estado IN('NEW','CONTACTED') AND etapa='BUYER' AND duplicado=0)
  OR (@estado='CONVERTED' AND etapa IN('LEAD','PAYER','CUSTOMER','TURNED'))
  OR (@estado='DISCARDED' AND estado_calidad='Rechazado') OR (@estado='DUPLICATED' AND duplicado=1)
),
Totales AS (
 SELECT COALESCE(SUM(CASE WHEN utilizable=1 AND captacion_periodo=1 AND dias_captacion BETWEEN 0 AND 14 THEN 1 ELSE 0 END),0) b1_n,
  COALESCE(SUM(CASE WHEN utilizable=1 AND captacion_periodo=1 THEN 1 ELSE 0 END),0) b1_d,
  COALESCE(SUM(CASE WHEN utilizable=1 AND (fecha_captacion IS NULL OR (captacion_periodo=1 AND ((avanzado=1 AND fecha_conversion IS NULL) OR dias_captacion<0))) THEN 1 ELSE 0 END),0) b1_faltantes,
  COALESCE(SUM(CASE WHEN registro_periodo=1 AND utilizable=1 THEN 1 ELSE 0 END),0) b2_n,
  COALESCE(SUM(registro_periodo),0) b2_d,
  COALESCE(SUM(CASE WHEN registro_periodo=1 AND (avanzado=1 OR fecha_conversion IS NOT NULL) THEN 1 ELSE 0 END),0) b3_d,
  COALESCE(SUM(CASE WHEN registro_periodo=1 AND (avanzado=1 OR fecha_conversion IS NOT NULL) AND (fecha_conversion IS NULL OR dias_registro<0) THEN 1 ELSE 0 END),0) b3_faltantes,
  SUM(CASE WHEN registro_periodo=1 AND (avanzado=1 OR fecha_conversion IS NOT NULL) THEN dias_registro ELSE 0 END) suma_dias
 FROM Filtrado
)
SELECT *,CASE WHEN b1_faltantes=0 AND b1_d>0 THEN 100.0*b1_n/b1_d ELSE NULL END b1_porcentaje,
 CASE WHEN b2_d>0 THEN 100.0*b2_n/b2_d ELSE NULL END b2_porcentaje,
 CASE WHEN b3_faltantes=0 AND b3_d>0 THEN suma_dias ELSE NULL END b3_total_dias,
 CASE WHEN b3_faltantes=0 AND b3_d>0 THEN suma_dias/b3_d ELSE NULL END b3_promedio_dias
FROM Totales OPTION(MAXDOP 1);
