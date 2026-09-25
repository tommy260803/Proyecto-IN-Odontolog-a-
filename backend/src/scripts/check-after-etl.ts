import { queryMart } from '../db/mart';

async function checkAfterEtl() {
  console.log('=== DIM_CANAL ===', await queryMart('SELECT * FROM Dim_Canal'));
  console.log('=== DIM_SEDE ===', await queryMart('SELECT * FROM Dim_Sede'));
  console.log('=== DIM_SERVICIO ===', await queryMart('SELECT * FROM Dim_Servicio'));
  console.log('=== DIM_PROFESIONAL ===', await queryMart('SELECT * FROM Dim_Profesional'));
  console.log('=== DIM_NEGOCIADOR ===', await queryMart('SELECT * FROM Dim_Negociador'));
  console.log('=== DIM_ESTADO_ATENCION ===', await queryMart('SELECT * FROM Dim_EstadoAtencion'));
  
  console.log('=== FACT_CAPTACION_BUYER ===', await queryMart('SELECT TOP 10 * FROM Fact_CaptacionBuyer'));
  console.log('=== FACT_ATENCION_CUSTOMER ===', await queryMart('SELECT TOP 10 * FROM Fact_AtencionCustomer'));
  console.log('=== FACT_GESTION_PAYER ===', await queryMart('SELECT TOP 10 * FROM Fact_GestionPayer'));
  console.log('=== FACT_NEGOCIACION_LEAD ===', await queryMart('SELECT TOP 10 * FROM Fact_NegociacionLead'));

  process.exit(0);
}

checkAfterEtl().catch(err => {
  console.error(err);
  process.exit(1);
});
