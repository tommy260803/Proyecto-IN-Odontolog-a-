async function run() {
  const res = await fetch('http://localhost:3001/api/reports/all-executive');
  const data = await res.json();
  console.log('BUYER:', JSON.stringify(data.buyer, null, 2));
  console.log('LEAD:', JSON.stringify(data.lead, null, 2));
  console.log('PAYER:', JSON.stringify(data.payer, null, 2));
  console.log('CUSTOMER:', JSON.stringify(data.customer, null, 2));
}

run().catch(console.error);
